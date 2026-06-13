import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { SAL_FREEZE_STORAGE_BUCKET } from "@/constants/salFreeze";
import {
  INCLUDI_LAVORAZIONI_A_ZERO_NEL_SAL_PERIODO,
} from "@/constants/salFreeze";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";
import {
  getErroreSupabase,
  throwErroreSupabase,
} from "@/services/rapportiIntervento/errors";
import type { CostoMacchinarioCommessa } from "@/types/costiMacchinari";
import type { SalLavorazioneFoto } from "@/types/sal";

type SupabaseClient = typeof supabaseAdmin;

export type SalFreezeDiagnosticStep =
  | "auth"
  | "admin_check"
  | "existing_freeze_check"
  | "load_sal_live"
  | "insert_header"
  | "insert_lavorazioni"
  | "copy_photos"
  | "insert_photos"
  | "insert_macchinari"
  | "cleanup"
  | "unexpected";

export const SAL_FREEZE_ERRORI = {
  INPUT_NON_VALIDO: "INPUT_NON_VALIDO",
  ACCESSO_NEGATO: "ACCESSO_NEGATO",
  FREEZE_ESISTENTE: "FREEZE_ESISTENTE",
  FREEZE_NON_TROVATO: "FREEZE_NON_TROVATO",
  FREEZE_GIA_ANNULLATO: "FREEZE_GIA_ANNULLATO",
  NESSUNA_LAVORAZIONE: "NESSUNA_LAVORAZIONE",
  FOTO_NON_TROVATA: "FOTO_NON_TROVATA",
  COPIA_FOTO_FALLITA: "COPIA_FOTO_FALLITA",
  ERRORE_GENERICO: "ERRORE_GENERICO",
} as const;

export type SalFreezeErrorCode =
  (typeof SAL_FREEZE_ERRORI)[keyof typeof SAL_FREEZE_ERRORI];

export class SalFreezeError extends Error {
  readonly code: SalFreezeErrorCode;
  readonly step?: SalFreezeDiagnosticStep;

  constructor(
    code: SalFreezeErrorCode,
    message: string,
    step?: SalFreezeDiagnosticStep
  ) {
    super(message);
    this.name = "SalFreezeError";
    this.code = code;
    this.step = step;
  }
}

function throwSalFreezeError(
  code: SalFreezeErrorCode,
  message: string,
  step?: SalFreezeDiagnosticStep
): never {
  throw new SalFreezeError(code, message, step);
}

function toSalFreezeError(
  error: unknown,
  step: SalFreezeDiagnosticStep
) {
  if (error instanceof SalFreezeError) {
    return new SalFreezeError(
      error.code,
      error.message,
      error.step || step
    );
  }

  const message =
    error instanceof Error ? error.message : "Errore freeze SAL";

  return new SalFreezeError(
    SAL_FREEZE_ERRORI.ERRORE_GENERICO,
    message,
    step
  );
}

async function runSalFreezeStep<T>(
  step: SalFreezeDiagnosticStep,
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  console.error(`[SAL_FREEZE] ${label}`, { step });

  try {
    return await operation();
  } catch (error: unknown) {
    throw toSalFreezeError(error, step);
  }
}

type FreezePrevRow = {
  lavorazione_id: string | null;
  lavorazione_nome_snapshot: string;
  percentuale_attuale: number;
};

type FreezeFotoSourceRow = Pick<
  SalLavorazioneFoto,
  | "id"
  | "cantiere_id"
  | "lavorazione_id"
  | "timbratura_id"
  | "data_riferimento"
  | "immagine_data_url"
  | "descrizione"
  | "created_by"
  | "created_at"
>;

type FreezeHeaderRow = {
  id: string;
  cantiere_id: string;
  period_start: string;
  period_end: string;
  freeze_at: string;
  created_by: string | null;
  note: string;
  metadata: Record<string, unknown> | null;
  annullato_at: string | null;
  annullato_by: string | null;
};

type SalFreezeLavorazioneInsert = {
  freeze_id: string;
  lavorazione_id: string | null;
  lavorazione_nome_snapshot: string;
  percentuale_precedente: number;
  percentuale_attuale: number;
  delta_percentuale: number;
  ore_uomo_minuti: number;
  ordine: number;
  azienda_id: string;
};

type SalFreezeFotoInsert = {
  freeze_id: string;
  cantiere_id: string;
  sal_foto_id: string;
  lavorazione_id: string | null;
  data_riferimento: string;
  storage_path_snapshot: string;
  descrizione: string;
  ordine: number;
  azienda_id: string;
};

type SalFreezeMacchinarioInsert = {
  freeze_id: string;
  macchinario_id: string | null;
  tipo_macchinario_snapshot: string;
  descrizione_snapshot: string;
  ore_utilizzo: number;
  note: string;
  ordine: number;
  azienda_id: string;
};

type MacchinarioFreezeSourceRow = Pick<
  CostoMacchinarioCommessa,
  | "macchinario_id"
  | "tipo_macchinario"
  | "descrizione"
  | "ore_utilizzo"
  | "note"
>;

type UploadedFreezePhoto = FreezeFotoSourceRow & {
  object_path: string;
  storage_path_snapshot: string;
};

type PreparedFreezePhoto = UploadedFreezePhoto & {
  copiedToStorage: boolean;
};

export type SalFreezeCreato = {
  freezeId: string;
  freeze: FreezeHeaderRow;
  lavorazioni: SalFreezeLavorazioneInsert[];
  foto: SalFreezeFotoInsert[];
  macchinari: SalFreezeMacchinarioInsert[];
};

const SELECT_FREEZE_PRECEDENTE =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by";
const SELECT_FREEZE_LAVORAZIONI =
  "lavorazione_id, lavorazione_nome_snapshot, percentuale_attuale";
const SELECT_SAL_FOTO =
  "id, cantiere_id, lavorazione_id, timbratura_id, data_riferimento, immagine_data_url, descrizione, created_by, created_at";
const SELECT_MACCHINARI =
  "macchinario_id, tipo_macchinario, descrizione, ore_utilizzo, note";

function normalizzaTesto(value: string) {
  return value.trim().toLowerCase();
}

function parseDataIso(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getExtDaDataUrl(dataUrl: string) {
  const match = /^data:image\/(png|jpe?g|webp);base64,/i.exec(
    dataUrl
  );

  if (!match) {
    return null;
  }

  const mime = match[1].toLowerCase();

  if (mime === "png") {
    return { ext: "png", contentType: "image/png" };
  }

  if (mime === "webp") {
    return { ext: "webp", contentType: "image/webp" };
  }

  return { ext: "jpg", contentType: "image/jpeg" };
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl);

  if (!match) {
    return null;
  }

  const info = getExtDaDataUrl(dataUrl);

  if (!info) {
    return null;
  }

  return {
    bytes: Buffer.from(match[2], "base64"),
    ...info,
  };
}

function isDataUrl(value: string) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(
    value
  );
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function getPercentualePrecedente({
  lavorazioneId,
  lavorazioneNome,
  freezePrecedenteById,
  freezePrecedenteByNome,
}: {
  lavorazioneId: string;
  lavorazioneNome: string;
  freezePrecedenteById: Map<string, FreezePrevRow>;
  freezePrecedenteByNome: Map<string, FreezePrevRow>;
}) {
  const freezeById = freezePrecedenteById.get(lavorazioneId);

  if (freezeById) {
    return freezeById.percentuale_attuale;
  }

  const freezeByNome = freezePrecedenteByNome.get(
    normalizzaTesto(lavorazioneNome)
  );

  return freezeByNome?.percentuale_attuale || 0;
}

async function loadFreezePrecedente(
  cantiereId: string,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("sal_freeze_mensili")
    .select(SELECT_FREEZE_PRECEDENTE)
    .eq("cantiere_id", cantiereId)
    .is("annullato_at", null)
    .order("freeze_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwErroreSupabase(
      "Lettura freeze SAL precedente",
      error
    );
  }

  return data as FreezeHeaderRow | null;
}

async function loadFreezePrecedenteLavorazioni(
  freezeId: string,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("sal_freeze_lavorazioni")
    .select(SELECT_FREEZE_LAVORAZIONI)
    .eq("freeze_id", freezeId)
    .order("ordine", { ascending: true });

  if (error) {
    throwErroreSupabase(
      "Lettura lavorazioni freeze SAL precedente",
      error
    );
  }

  return (data || []) as FreezePrevRow[];
}

async function loadSelectedPhotos(
  cantiereId: string,
  selectedPhotoIds: string[],
  supabaseClient: SupabaseClient
) {
  if (selectedPhotoIds.length === 0) {
    return [] as FreezeFotoSourceRow[];
  }

  const { data, error } = await supabaseClient
    .from("sal_lavorazioni_foto")
    .select(SELECT_SAL_FOTO)
    .eq("cantiere_id", cantiereId)
    .in("id", selectedPhotoIds);

  if (error) {
    throwErroreSupabase(
      "Lettura foto SAL selezionate",
      error
    );
  }

  const fotoById = new Map(
    ((data || []) as FreezeFotoSourceRow[]).map((foto) => [
      foto.id,
      foto,
    ])
  );

  return selectedPhotoIds.map((photoId) => {
    const foto = fotoById.get(photoId);

    if (!foto) {
      throwSalFreezeError(
        SAL_FREEZE_ERRORI.FOTO_NON_TROVATA,
        `Foto SAL non trovata o non valida: ${photoId}`
      );
    }

    return foto;
  });
}

async function loadMacchinariFreeze(
  cantiereId: string,
  supabaseClient: SupabaseClient
) {
  const { data, error } = await supabaseClient
    .from("costi_macchinari_commessa")
    .select(SELECT_MACCHINARI)
    .eq("cantiere_id", cantiereId)
    .order("data_utilizzo", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throwErroreSupabase(
      "Lettura macchinari freeze SAL",
      error
    );
  }

  return (data || []) as MacchinarioFreezeSourceRow[];
}

async function insertHeaderFreeze({
  freezeId,
  cantiereId,
  periodStart,
  periodEnd,
  createdBy,
  aziendaId,
  note,
  supabaseClient,
}: {
  freezeId: string;
  cantiereId: string;
  periodStart: string;
  periodEnd: string;
  createdBy: string | null;
  aziendaId: string;
  note: string;
  supabaseClient: SupabaseClient;
}) {
  const metadata = {
    schema: "sal-freeze-mensile",
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("sal_freeze_mensili")
    .insert({
      id: freezeId,
      cantiere_id: cantiereId,
      period_start: periodStart,
      period_end: periodEnd,
      freeze_at: new Date().toISOString(),
      created_by: createdBy,
      note,
      metadata,
      azienda_id: aziendaId,
    })
    .select(SELECT_FREEZE_PRECEDENTE)
    .single();

  if (error) {
    throwErroreSupabase(
      "Creazione freeze SAL",
      error
    );
  }

  return data as FreezeHeaderRow;
}

async function uploadFotoFreeze({
  freezeId,
  cantiereId,
  foto,
  supabaseClient,
}: {
  freezeId: string;
  cantiereId: string;
  foto: FreezeFotoSourceRow[];
  supabaseClient: SupabaseClient;
}) {
  const uploadedPhotos: PreparedFreezePhoto[] = [];

  for (let index = 0; index < foto.length; index += 1) {
    const currentFoto = foto[index];
    const immagineOriginale =
      currentFoto.immagine_data_url.trim();

    if (isHttpUrl(immagineOriginale)) {
      uploadedPhotos.push({
        ...currentFoto,
        object_path: immagineOriginale,
        storage_path_snapshot: immagineOriginale,
        copiedToStorage: false,
      });
      continue;
    }

    if (!isDataUrl(immagineOriginale)) {
      console.warn("[SAL_FREEZE] foto SAL non supportata", {
        step: "copy_photos",
        fotoId: currentFoto.id,
        cantiereId,
        freezeId,
      });
      continue;
    }

    const parsed = decodeDataUrl(immagineOriginale);

    if (!parsed) {
      console.warn("[SAL_FREEZE] foto SAL non decodificabile", {
        step: "copy_photos",
        fotoId: currentFoto.id,
        cantiereId,
        freezeId,
      });
      continue;
    }

    const fileName = sanitizeFileName(
      `foto-${index + 1}-${currentFoto.id}.${parsed.ext}`
    );
    const objectPath = `${cantiereId}/${freezeId}/${fileName}`;
    const storagePathSnapshot = `${SAL_FREEZE_STORAGE_BUCKET}/${objectPath}`;

    const { error } = await supabaseClient.storage
      .from(SAL_FREEZE_STORAGE_BUCKET)
      .upload(objectPath, parsed.bytes, {
        contentType: parsed.contentType,
        upsert: false,
      });

    if (error) {
      console.warn("[SAL_FREEZE] copia foto SAL fallita", {
        step: "copy_photos",
        fotoId: currentFoto.id,
        cantiereId,
        freezeId,
        errorMessage: getErroreSupabase(error),
      });

      uploadedPhotos.push({
        ...currentFoto,
        object_path: immagineOriginale,
        storage_path_snapshot: immagineOriginale,
        copiedToStorage: false,
      });
      continue;
    }

    uploadedPhotos.push({
      ...currentFoto,
      object_path: objectPath,
      storage_path_snapshot: storagePathSnapshot,
      copiedToStorage: true,
    });
  }

  return uploadedPhotos;
}

async function cleanupFreeze({
  freezeId,
  uploadedPaths,
  supabaseClient,
}: {
  freezeId: string;
  uploadedPaths: string[];
  supabaseClient: SupabaseClient;
}) {
  if (uploadedPaths.length > 0) {
    await supabaseClient.storage
      .from(SAL_FREEZE_STORAGE_BUCKET)
      .remove(uploadedPaths)
      .catch(() => null);
  }

  try {
    await supabaseClient
      .from("sal_freeze_macchinari")
      .delete()
      .eq("freeze_id", freezeId);
  } catch {}

  try {
    await supabaseClient
      .from("sal_freeze_foto")
      .delete()
      .eq("freeze_id", freezeId);
  } catch {}

  try {
    await supabaseClient
      .from("sal_freeze_lavorazioni")
      .delete()
      .eq("freeze_id", freezeId);
  } catch {}

  try {
    await supabaseClient
      .from("sal_freeze_mensili")
      .delete()
      .eq("id", freezeId);
  } catch {}
}

async function loadCollaborazioniFreeze(
  cantiereId: string,
  supabaseClient: SupabaseClient
): Promise<
  {
    azienda_collaboratrice_nome: string;
    cantiere_collaboratore_nome: string;
    lavorazione_nome: string;
    percentuale_completamento: number;
    ordine: number;
  }[]
> {
  // Collaborazioni accettate dove questo cantiere è il committente
  const { data: collab, error: collabError } = await supabaseClient
    .from("cantieri_collaborazioni")
    .select(
      "azienda_collaboratrice_nome, cantiere_collaboratore_nome, cantiere_collaboratore_id"
    )
    .eq("cantiere_committente_id", cantiereId)
    .eq("stato", "accettata");

  if (collabError || !collab || collab.length === 0) {
    return [];
  }

  const righe: {
    azienda_collaboratrice_nome: string;
    cantiere_collaboratore_nome: string;
    lavorazione_nome: string;
    percentuale_completamento: number;
    ordine: number;
  }[] = [];

  for (const c of collab) {
    if (!c.cantiere_collaboratore_id) continue;
    const { data: lavorazioni } = await supabaseClient
      .from("lavorazioni_cantiere")
      .select("nome, percentuale_completamento, ordine, attiva, stato")
      .eq("cantiere_id", c.cantiere_collaboratore_id)
      .eq("attiva", true)
      .neq("stato", "rifiutata")
      .order("ordine", { ascending: true });

    for (const l of lavorazioni || []) {
      righe.push({
        azienda_collaboratrice_nome: c.azienda_collaboratrice_nome,
        cantiere_collaboratore_nome: c.cantiere_collaboratore_nome,
        lavorazione_nome: l.nome,
        percentuale_completamento: l.percentuale_completamento,
        ordine: l.ordine,
      });
    }
  }

  return righe;
}

export async function createSalFreeze({
  cantiereId,
  periodStart,
  periodEnd,
  selectedPhotoIds,
  note,
  userEmail,
  userId,
  supabaseClient = supabaseAdmin,
}: {
  cantiereId: string;
  periodStart: string;
  periodEnd: string;
  selectedPhotoIds: string[];
  note?: string;
  userEmail: string;
  userId: string;
  supabaseClient?: SupabaseClient;
}): Promise<SalFreezeCreato> {
  if (!cantiereId) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.INPUT_NON_VALIDO,
      "Seleziona un cantiere",
      "auth"
    );
  }

  const parsedStart = parseDataIso(periodStart);
  const parsedEnd = parseDataIso(periodEnd);

  if (!parsedStart || !parsedEnd) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.INPUT_NON_VALIDO,
      "Periodo freeze non valido",
      "auth"
    );
  }

  if (parsedStart.getTime() > parsedEnd.getTime()) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.INPUT_NON_VALIDO,
      "Periodo freeze non valido",
      "auth"
    );
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabaseAdmin,
    userId
  );

  const utenteAdmin = await isAdmin(
    userEmail,
    supabaseAdmin
  );

  if (!utenteAdmin) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.ACCESSO_NEGATO,
      "Accesso non autorizzato",
      "admin_check"
    );
  }

  const { data: freezeEsistente, error: freezeEsistenteError } =
    await runSalFreezeStep(
      "existing_freeze_check",
      "existing freeze check",
      async () =>
        supabaseClient
          .from("sal_freeze_mensili")
          .select("id")
          .eq("cantiere_id", cantiereId)
          .eq("period_start", periodStart)
          .eq("period_end", periodEnd)
          .is("annullato_at", null)
          .limit(1)
          .maybeSingle()
    );

  if (freezeEsistenteError) {
    throwErroreSupabase(
      "Lettura freeze SAL esistente",
      freezeEsistenteError
    );
  }

  if (freezeEsistente) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.FREEZE_ESISTENTE,
      "Freeze SAL gia esistente per il periodo selezionato",
      "existing_freeze_check"
    );
  }

  const [freezePrecedente, salLive, fotoSelezionate, macchinari] =
    await Promise.all([
      runSalFreezeStep(
        "existing_freeze_check",
        "load freeze precedente",
        () => loadFreezePrecedente(cantiereId, supabaseClient)
      ),
      runSalFreezeStep(
        "load_sal_live",
        "load sal live",
        () => loadSalCantiere(cantiereId, supabaseClient)
      ),
      runSalFreezeStep(
        "copy_photos",
        "load selected photos",
        () =>
          loadSelectedPhotos(
            cantiereId,
            Array.from(new Set(selectedPhotoIds)),
            supabaseClient
          )
      ),
      runSalFreezeStep(
        "insert_macchinari",
        "load macchinari freeze",
        () => loadMacchinariFreeze(cantiereId, supabaseClient)
      ),
    ]);

  const collaborazioniFreezeRows = await runSalFreezeStep(
    "load_sal_live",
    "load collaborazioni freeze",
    () => loadCollaborazioniFreeze(cantiereId, supabaseClient)
  );

  // Il freeze è valido se c'è almeno una lavorazione propria O del
  // subappaltatore (committente che monitora solo il subappalto)
  if (
    salLive.lavorazioni.length === 0 &&
    collaborazioniFreezeRows.length === 0
  ) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.NESSUNA_LAVORAZIONE,
      "Nessuna lavorazione SAL trovata per il cantiere selezionato",
      "load_sal_live"
    );
  }

  const freezePrecedenteRows = freezePrecedente
    ? await loadFreezePrecedenteLavorazioni(
        freezePrecedente.id,
        supabaseClient
      )
    : [];

  const freezePrecedenteById = new Map(
    freezePrecedenteRows
      .filter((row) => row.lavorazione_id)
      .map((row) => [row.lavorazione_id as string, row])
  );
  const freezePrecedenteByNome = new Map(
    freezePrecedenteRows.map((row) => [
      normalizzaTesto(row.lavorazione_nome_snapshot),
      row,
    ])
  );

  const freezeId = crypto.randomUUID();
  const uploadedPhotos = await runSalFreezeStep(
    "copy_photos",
    "copy/upload foto storage",
    () =>
      uploadFotoFreeze({
        freezeId,
        cantiereId,
        foto: fotoSelezionate,
        supabaseClient,
      })
  );
  const uploadedPaths = uploadedPhotos
    .filter((foto) => foto.copiedToStorage)
    .map((foto) => foto.object_path);

  const lavorazioniFreeze: SalFreezeLavorazioneInsert[] = salLive.lavorazioni
    .map((lavorazione) => {
      const percentualePrecedente = getPercentualePrecedente({
        lavorazioneId: lavorazione.id,
        lavorazioneNome: lavorazione.nome,
        freezePrecedenteById,
        freezePrecedenteByNome,
      });

      const percentualeAttuale =
        lavorazione.percentuale_completamento;
      const deltaPercentuale =
        percentualeAttuale - percentualePrecedente;
      const oreUomoMinuti = lavorazione.oreUomoMinuti;

      return {
        freeze_id: freezeId,
        lavorazione_id: lavorazione.id,
        lavorazione_nome_snapshot: lavorazione.nome,
        percentuale_precedente: percentualePrecedente,
        percentuale_attuale: percentualeAttuale,
        delta_percentuale: deltaPercentuale,
        ore_uomo_minuti: oreUomoMinuti,
        ordine: lavorazione.ordine,
        azienda_id: aziendaId,
      };
    })
    .filter((lavorazione) => {
      if (INCLUDI_LAVORAZIONI_A_ZERO_NEL_SAL_PERIODO) {
        return true;
      }

      return (
        lavorazione.percentuale_attuale > 0 ||
        lavorazione.delta_percentuale !== 0 ||
        lavorazione.ore_uomo_minuti > 0
      );
    });

  const fotoFreeze: SalFreezeFotoInsert[] = uploadedPhotos.map(
    (foto, index) => ({
      freeze_id: freezeId,
      cantiere_id: cantiereId,
      sal_foto_id: foto.id,
      lavorazione_id: foto.lavorazione_id,
      data_riferimento: foto.data_riferimento,
      storage_path_snapshot: foto.storage_path_snapshot,
      descrizione: foto.descrizione || "",
      ordine: index,
      azienda_id: aziendaId,
    })
  );

  const macchinariFreeze: SalFreezeMacchinarioInsert[] = macchinari.map(
    (macchinario, index) => ({
      freeze_id: freezeId,
      macchinario_id: macchinario.macchinario_id,
      tipo_macchinario_snapshot: macchinario.tipo_macchinario,
      descrizione_snapshot: macchinario.descrizione,
      ore_utilizzo: macchinario.ore_utilizzo,
      note: macchinario.note,
      ordine: index,
      azienda_id: aziendaId,
    })
  );

  let freezeHeader: FreezeHeaderRow | null = null;

  try {
    freezeHeader = await runSalFreezeStep(
      "insert_header",
      "insert sal_freeze_mensili",
      () =>
        insertHeaderFreeze({
          freezeId,
          cantiereId,
          periodStart,
          periodEnd,
          createdBy: userId,
          aziendaId,
          note: note?.trim() || "",
          supabaseClient,
        })
    );

    if (lavorazioniFreeze.length > 0) {
      const { error } = await runSalFreezeStep(
        "insert_lavorazioni",
        "insert sal_freeze_lavorazioni",
        async () =>
          await supabaseClient
            .from("sal_freeze_lavorazioni")
            .insert(lavorazioniFreeze)
      );

      if (error) {
        throwErroreSupabase(
          "Salvataggio lavorazioni freeze SAL",
          error
        );
      }
    }

    if (fotoFreeze.length > 0) {
      const { error } = await runSalFreezeStep(
        "insert_photos",
        "insert sal_freeze_foto",
        async () =>
          await supabaseClient
            .from("sal_freeze_foto")
            .insert(fotoFreeze)
      );

      if (error) {
        throwErroreSupabase(
          "Salvataggio foto freeze SAL",
          error
        );
      }
    }

    if (macchinariFreeze.length > 0) {
      const { error } = await runSalFreezeStep(
        "insert_macchinari",
        "insert sal_freeze_macchinari",
        async () =>
          await supabaseClient
            .from("sal_freeze_macchinari")
            .insert(macchinariFreeze)
      );

      if (error) {
        throwErroreSupabase(
          "Salvataggio macchinari freeze SAL",
          error
        );
      }
    }

    if (collaborazioniFreezeRows.length > 0) {
      const collaborazioniInsert = collaborazioniFreezeRows.map((r, index) => ({
        freeze_id: freezeId,
        azienda_id: aziendaId,
        azienda_collaboratrice_nome: r.azienda_collaboratrice_nome,
        cantiere_collaboratore_nome: r.cantiere_collaboratore_nome,
        lavorazione_nome: r.lavorazione_nome,
        percentuale_completamento: r.percentuale_completamento,
        ordine: index,
      }));

      const { error } = await runSalFreezeStep(
        "insert_lavorazioni",
        "insert sal_freeze_collaborazioni",
        async () =>
          await supabaseClient
            .from("sal_freeze_collaborazioni")
            .insert(collaborazioniInsert)
      );

      if (error) {
        throwErroreSupabase(
          "Salvataggio collaborazioni freeze SAL",
          error
        );
      }
    }

    return {
      freezeId: freezeHeader.id,
      freeze: freezeHeader,
      lavorazioni: lavorazioniFreeze,
      foto: fotoFreeze,
      macchinari: macchinariFreeze,
    };
  } catch (error: unknown) {
    const originalError =
      error instanceof SalFreezeError
        ? error
        : new SalFreezeError(
            SAL_FREEZE_ERRORI.ERRORE_GENERICO,
            error instanceof Error
              ? error.message
              : "Errore imprevisto durante la creazione SAL periodo",
            "unexpected"
          );

    console.error("[SAL_FREEZE] errore originale freeze SAL", {
      step: originalError.step || "unexpected",
      errorCode: originalError.code,
      errorMessage: originalError.message,
    });

    try {
      console.error("[SAL_FREEZE] cleanup eventuale", {
        step: "cleanup",
        freezeId,
        uploadedCount: uploadedPaths.length,
      });

      await cleanupFreeze({
        freezeId,
        uploadedPaths,
        supabaseClient,
      });
    } catch (cleanupError: unknown) {
      console.error("[sal-freeze-cleanup-error]", {
        step: "cleanup",
        errorMessage:
          cleanupError instanceof Error
            ? cleanupError.message
            : "Errore cleanup",
      });
    }

    throw originalError;
  }
}
