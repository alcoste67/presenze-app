import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SAL_FREEZE_STORAGE_BUCKET } from "@/constants/salFreeze";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";
import {
  getErroreSupabase,
  throwErroreSupabase,
} from "@/services/rapportiIntervento/errors";
import type { CostoMacchinarioCommessa } from "@/types/costiMacchinari";
import type { SalLavorazioneFoto } from "@/types/sal";

type SupabaseClient = typeof supabaseAdmin;

export const SAL_FREEZE_ERRORI = {
  INPUT_NON_VALIDO: "INPUT_NON_VALIDO",
  ACCESSO_NEGATO: "ACCESSO_NEGATO",
  FREEZE_ESISTENTE: "FREEZE_ESISTENTE",
  FREEZE_NON_TROVATO: "FREEZE_NON_TROVATO",
  FREEZE_GIA_ANNULLATO: "FREEZE_GIA_ANNULLATO",
  NESSUNA_LAVORAZIONE: "NESSUNA_LAVORAZIONE",
  FOTO_NON_TROVATA: "FOTO_NON_TROVATA",
  COPIA_FOTO_FALLITA: "COPIA_FOTO_FALLITA",
} as const;

export type SalFreezeErrorCode =
  (typeof SAL_FREEZE_ERRORI)[keyof typeof SAL_FREEZE_ERRORI];

export class SalFreezeError extends Error {
  readonly code: SalFreezeErrorCode;

  constructor(code: SalFreezeErrorCode, message: string) {
    super(message);
    this.name = "SalFreezeError";
    this.code = code;
  }
}

function throwSalFreezeError(
  code: SalFreezeErrorCode,
  message: string
): never {
  throw new SalFreezeError(code, message);
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
};

type SalFreezeMacchinarioInsert = {
  freeze_id: string;
  macchinario_id: string | null;
  tipo_macchinario_snapshot: string;
  descrizione_snapshot: string;
  ore_utilizzo: number;
  note: string;
  ordine: number;
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

export type SalFreezeCreato = {
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
  note,
  supabaseClient,
}: {
  freezeId: string;
  cantiereId: string;
  periodStart: string;
  periodEnd: string;
  createdBy: string | null;
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
  const uploadedPhotos: UploadedFreezePhoto[] = [];

  for (let index = 0; index < foto.length; index += 1) {
    const currentFoto = foto[index];
    const parsed = decodeDataUrl(currentFoto.immagine_data_url);

    if (!parsed) {
      throw new Error(
        `Formato immagine non supportato per foto ${currentFoto.id}`
      );
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
      throwSalFreezeError(
        SAL_FREEZE_ERRORI.COPIA_FOTO_FALLITA,
        `Upload foto freeze SAL: ${getErroreSupabase(error)}`
      );
    }

    uploadedPhotos.push({
      ...currentFoto,
      object_path: objectPath,
      storage_path_snapshot: storagePathSnapshot,
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
      "Seleziona un cantiere"
    );
  }

  const parsedStart = parseDataIso(periodStart);
  const parsedEnd = parseDataIso(periodEnd);

  if (!parsedStart || !parsedEnd) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.INPUT_NON_VALIDO,
      "Periodo freeze non valido"
    );
  }

  if (parsedStart.getTime() > parsedEnd.getTime()) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.INPUT_NON_VALIDO,
      "Periodo freeze non valido"
    );
  }

  const utenteAdmin = await isAdmin(
    userEmail,
    supabaseAdmin
  );

  if (!utenteAdmin) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.ACCESSO_NEGATO,
      "Accesso non autorizzato"
    );
  }

  const { data: freezeEsistente, error: freezeEsistenteError } =
    await supabaseClient
      .from("sal_freeze_mensili")
      .select("id")
      .eq("cantiere_id", cantiereId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .is("annullato_at", null)
      .limit(1)
      .maybeSingle();

  if (freezeEsistenteError) {
    throwErroreSupabase(
      "Lettura freeze SAL esistente",
      freezeEsistenteError
    );
  }

  if (freezeEsistente) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.FREEZE_ESISTENTE,
      "Freeze SAL gia esistente per il periodo selezionato"
    );
  }

  const [freezePrecedente, salLive, fotoSelezionate, macchinari] =
    await Promise.all([
      loadFreezePrecedente(cantiereId, supabaseClient),
      loadSalCantiere(cantiereId, supabaseClient),
      loadSelectedPhotos(
        cantiereId,
        Array.from(new Set(selectedPhotoIds)),
        supabaseClient
      ),
      loadMacchinariFreeze(cantiereId, supabaseClient),
    ]);

  if (salLive.lavorazioni.length === 0) {
    throwSalFreezeError(
      SAL_FREEZE_ERRORI.NESSUNA_LAVORAZIONE,
      "Nessuna lavorazione SAL trovata per il cantiere selezionato"
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
  const uploadedPhotos = await uploadFotoFreeze({
    freezeId,
    cantiereId,
    foto: fotoSelezionate,
    supabaseClient,
  });
  const uploadedPaths = uploadedPhotos.map(
    (foto) => foto.object_path
  );

  const lavorazioniFreeze: SalFreezeLavorazioneInsert[] = salLive.lavorazioni.map(
    (lavorazione) => {
      const percentualePrecedente = getPercentualePrecedente({
        lavorazioneId: lavorazione.id,
        lavorazioneNome: lavorazione.nome,
        freezePrecedenteById,
        freezePrecedenteByNome,
      });

      return {
        freeze_id: freezeId,
        lavorazione_id: lavorazione.id,
        lavorazione_nome_snapshot: lavorazione.nome,
        percentuale_precedente: percentualePrecedente,
        percentuale_attuale:
          lavorazione.percentuale_completamento,
        delta_percentuale:
          lavorazione.percentuale_completamento -
          percentualePrecedente,
        ore_uomo_minuti: lavorazione.oreUomoMinuti,
        ordine: lavorazione.ordine,
      };
    }
  );

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
    })
  );

  let freezeHeader: FreezeHeaderRow | null = null;

  try {
    freezeHeader = await insertHeaderFreeze({
      freezeId,
      cantiereId,
      periodStart,
      periodEnd,
      createdBy: userId,
      note: note?.trim() || "",
      supabaseClient,
    });

    if (lavorazioniFreeze.length > 0) {
      const { error } = await supabaseClient
        .from("sal_freeze_lavorazioni")
        .insert(lavorazioniFreeze);

      if (error) {
        throwErroreSupabase(
          "Salvataggio lavorazioni freeze SAL",
          error
        );
      }
    }

    if (fotoFreeze.length > 0) {
      const { error } = await supabaseClient
        .from("sal_freeze_foto")
        .insert(fotoFreeze);

      if (error) {
        throwErroreSupabase(
          "Salvataggio foto freeze SAL",
          error
        );
      }
    }

    if (macchinariFreeze.length > 0) {
      const { error } = await supabaseClient
        .from("sal_freeze_macchinari")
        .insert(macchinariFreeze);

      if (error) {
        throwErroreSupabase(
          "Salvataggio macchinari freeze SAL",
          error
        );
      }
    }

    return {
      freeze: freezeHeader,
      lavorazioni: lavorazioniFreeze,
      foto: fotoFreeze,
      macchinari: macchinariFreeze,
    };
  } catch (error: unknown) {
    await cleanupFreeze({
      freezeId,
      uploadedPaths,
      supabaseClient,
    });

    if (error instanceof SalFreezeError) {
      throw error;
    }

    throwErroreSupabase("Creazione freeze SAL", error);
  }
}
