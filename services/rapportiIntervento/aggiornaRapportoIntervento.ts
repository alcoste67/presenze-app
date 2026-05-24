import {
  RAPPORTI_INTERVENTO_STATI,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import { supabase } from "@/lib/supabase";
import { calcolaOreFatturabili } from "@/services/rapportiIntervento/calcolaOreFatturabili";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { loadRapportoIntervento } from "@/services/rapportiIntervento/loadRapportoIntervento";
import type {
  RapportoIntervento,
  RapportoInterventoCompleto,
  RapportoInterventoFoto,
  RapportoInterventoFotoInput,
  RapportoInterventoInput,
  RapportoInterventoLavorazione,
  RapportoInterventoLavorazioneInput,
  RapportoInterventoMateriale,
  RapportoInterventoMaterialeInput,
  StatoRapportoIntervento,
} from "@/types/rapportiIntervento";

type SupabaseClient = typeof supabase;

type Params = {
  rapportoInterventoId: string;
  rapporto: RapportoInterventoInput;
};

type CantiereSnapshot = {
  id: string;
  nome: string;
  indirizzo: string;
};

const SELECT_CANTIERE =
  "id, nome, indirizzo";
const SELECT_RAPPORTO_INTERVENTO =
  "id, cantiere_id, cantiere_nome_snapshot, cantiere_indirizzo_snapshot, data_intervento, cliente_committente, responsabile_nome, ore_uomo_reali_minuti, viaggio_minuti, diritto_uscita, regola_fatturazione, ore_fatturabili_minuti, note, firma_responsabile_data_url, firma_responsabile_nome, firma_responsabile_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, created_at, updated_at";
const SELECT_RAPPORTO_INTERVENTO_LAVORAZIONE =
  "id, rapporto_intervento_id, lavorazione_id, descrizione_snapshot, ore_uomo_minuti, ordine, created_at";
const SELECT_RAPPORTO_INTERVENTO_FOTO =
  "id, rapporto_intervento_id, immagine_data_url, descrizione, ordine, created_at";
const SELECT_RAPPORTO_INTERVENTO_MATERIALE =
  "id, rapporto_intervento_id, descrizione, quantita, unita_misura, ordine, created_at";

async function loadCantiereSnapshot(
  cantiereId: string,
  supabaseClient: SupabaseClient
): Promise<CantiereSnapshot> {
  const { data, error } = await supabaseClient
    .from("cantieri")
    .select(SELECT_CANTIERE)
    .eq("id", cantiereId)
    .maybeSingle();

  if (error) {
    throwErroreSupabase(
      "Lettura cantiere rapporto intervento",
      error
    );
  }

  if (!data) {
    throw new Error(
      RAPPORTI_INTERVENTO_TESTI.ERRORI
        .CANTIERE_NON_TROVATO
    );
  }

  return data as CantiereSnapshot;
}

function getOreUomoRealiMinuti(
  lavorazioni: RapportoInterventoLavorazioneInput[]
) {
  return lavorazioni.reduce(
    (totale, lavorazione) =>
      totale + lavorazione.ore_uomo_minuti,
    0
  );
}

function getStatoDaFirme(
  rapporto: RapportoInterventoInput
): StatoRapportoIntervento {
  if (
    rapporto.firma_responsabile_data_url &&
    rapporto.firma_cliente_data_url
  ) {
    return RAPPORTI_INTERVENTO_STATI.FIRMATO;
  }

  return RAPPORTI_INTERVENTO_STATI.BOZZA;
}

function getFirmaAt({
  firmaDataUrl,
  firmaAtCorrente,
}: {
  firmaDataUrl: string | null;
  firmaAtCorrente: string | null;
}) {
  if (!firmaDataUrl) {
    return null;
  }

  return (
    firmaAtCorrente ||
    new Date().toISOString()
  );
}

async function insertLavorazioni({
  rapportoInterventoId,
  lavorazioni,
  supabaseClient,
}: {
  rapportoInterventoId: string;
  lavorazioni: RapportoInterventoLavorazioneInput[];
  supabaseClient: SupabaseClient;
}) {
  if (lavorazioni.length === 0) {
    return [];
  }

  const righe = lavorazioni.map(
    (lavorazione) => ({
      rapporto_intervento_id:
        rapportoInterventoId,
      lavorazione_id:
        lavorazione.lavorazione_id,
      descrizione_snapshot:
        lavorazione.descrizione_snapshot,
      ore_uomo_minuti:
        lavorazione.ore_uomo_minuti,
      ordine: lavorazione.ordine,
    })
  );

  const { data, error } = await supabaseClient
    .from("rapporti_intervento_lavorazioni")
    .insert(righe)
    .select(
      SELECT_RAPPORTO_INTERVENTO_LAVORAZIONE
    );

  if (error) {
    throwErroreSupabase(
      "Salvataggio lavorazioni rapporto intervento",
      error
    );
  }

  return (
    data || []
  ) as RapportoInterventoLavorazione[];
}

async function insertFoto({
  rapportoInterventoId,
  foto,
  supabaseClient,
}: {
  rapportoInterventoId: string;
  foto: RapportoInterventoFotoInput[];
  supabaseClient: SupabaseClient;
}) {
  if (foto.length === 0) {
    return [];
  }

  const righe = foto.map((immagine) => ({
    rapporto_intervento_id:
      rapportoInterventoId,
    immagine_data_url:
      immagine.immagine_data_url,
    descrizione: immagine.descrizione,
    ordine: immagine.ordine,
  }));

  const { data, error } = await supabaseClient
    .from("rapporti_intervento_foto")
    .insert(righe)
    .select(SELECT_RAPPORTO_INTERVENTO_FOTO);

  if (error) {
    throwErroreSupabase(
      "Salvataggio foto rapporto intervento",
      error
    );
  }

  return (
    data || []
  ) as RapportoInterventoFoto[];
}

async function insertMateriali({
  rapportoInterventoId,
  materiali,
  supabaseClient,
}: {
  rapportoInterventoId: string;
  materiali: RapportoInterventoMaterialeInput[];
  supabaseClient: SupabaseClient;
}) {
  if (materiali.length === 0) {
    return [];
  }

  const righe = materiali.map(
    (materiale) => ({
      rapporto_intervento_id:
        rapportoInterventoId,
      descrizione: materiale.descrizione,
      quantita: materiale.quantita,
      unita_misura:
        materiale.unita_misura,
      ordine: materiale.ordine,
    })
  );

  const { data, error } = await supabaseClient
    .from("rapporti_intervento_materiali")
    .insert(righe)
    .select(
      SELECT_RAPPORTO_INTERVENTO_MATERIALE
    );

  if (error) {
    throwErroreSupabase(
      "Salvataggio materiali rapporto intervento",
      error
    );
  }

  return (
    data || []
  ) as RapportoInterventoMateriale[];
}

export async function aggiornaRapportoIntervento(
  {
    rapportoInterventoId,
    rapporto: rapportoInput,
  }: Params,
  supabaseClient: SupabaseClient = supabase
): Promise<RapportoInterventoCompleto> {
  const rapportoCorrente =
    await loadRapportoIntervento(
      rapportoInterventoId,
      supabaseClient
    );

  if (!rapportoCorrente) {
    throw new Error(
      RAPPORTI_INTERVENTO_TESTI.ERRORI
        .RAPPORTO_NON_TROVATO
    );
  }

  if (
    rapportoCorrente.stato ===
    RAPPORTI_INTERVENTO_STATI.FIRMATO
  ) {
    throw new Error(
      RAPPORTI_INTERVENTO_TESTI.ERRORI
        .RAPPORTO_FIRMATO
    );
  }

  const cantiere = await loadCantiereSnapshot(
    rapportoInput.cantiere_id,
    supabaseClient
  );
  const oreUomoRealiMinuti =
    getOreUomoRealiMinuti(
      rapportoInput.lavorazioni
    );
  const calcolo = calcolaOreFatturabili({
    oreUomoRealiMinuti,
    viaggioMinuti:
      rapportoInput.viaggio_minuti,
  });
  const stato =
    getStatoDaFirme(rapportoInput);

  const { data, error } = await supabaseClient
    .from("rapporti_intervento")
    .update({
      cantiere_id: cantiere.id,
      cantiere_nome_snapshot: cantiere.nome,
      cantiere_indirizzo_snapshot:
        cantiere.indirizzo,
      data_intervento:
        rapportoInput.data_intervento,
      cliente_committente:
        rapportoInput.cliente_committente,
      responsabile_nome:
        rapportoInput.responsabile_nome,
      ore_uomo_reali_minuti:
        oreUomoRealiMinuti,
      viaggio_minuti:
        rapportoInput.viaggio_minuti,
      diritto_uscita:
        rapportoInput.diritto_uscita,
      regola_fatturazione:
        calcolo.regola_fatturazione,
      ore_fatturabili_minuti:
        calcolo.ore_fatturabili_minuti,
      note: rapportoInput.note,
      firma_responsabile_data_url:
        rapportoInput.firma_responsabile_data_url,
      firma_responsabile_nome:
        rapportoInput.firma_responsabile_nome,
      firma_responsabile_at: getFirmaAt({
        firmaDataUrl:
          rapportoInput.firma_responsabile_data_url,
        firmaAtCorrente:
          rapportoCorrente.firma_responsabile_at,
      }),
      firma_cliente_data_url:
        rapportoInput.firma_cliente_data_url,
      firma_cliente_nome:
        rapportoInput.firma_cliente_nome,
      firma_cliente_at: getFirmaAt({
        firmaDataUrl:
          rapportoInput.firma_cliente_data_url,
        firmaAtCorrente:
          rapportoCorrente.firma_cliente_at,
      }),
      stato,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rapportoInterventoId)
    .select(SELECT_RAPPORTO_INTERVENTO)
    .single();

  if (error) {
    throwErroreSupabase(
      "Aggiornamento rapporto intervento",
      error
    );
  }

  const [nuoveLavorazioni, nuoveFoto, nuoviMateriali] =
    await Promise.all([
      insertLavorazioni({
        rapportoInterventoId,
        lavorazioni:
          rapportoInput.lavorazioni,
        supabaseClient,
      }),
      insertFoto({
        rapportoInterventoId,
        foto: rapportoInput.foto,
        supabaseClient,
      }),
      insertMateriali({
        rapportoInterventoId,
        materiali:
          rapportoInput.materiali,
        supabaseClient,
      }),
    ]);
  const lavorazioneIdsDaEliminare =
    rapportoCorrente.lavorazioni.map(
      (lavorazione) => lavorazione.id
    );
  const fotoIdsDaEliminare =
    rapportoCorrente.foto.map(
      (foto) => foto.id
    );
  const materialeIdsDaEliminare =
    rapportoCorrente.materiali.map(
      (materiale) => materiale.id
    );

  if (
    lavorazioneIdsDaEliminare.length > 0 ||
    fotoIdsDaEliminare.length > 0 ||
    materialeIdsDaEliminare.length > 0
  ) {
    if (lavorazioneIdsDaEliminare.length > 0) {
      const { error: deleteError } =
        await supabaseClient
          .from(
            "rapporti_intervento_lavorazioni"
          )
          .delete()
          .in(
            "id",
            lavorazioneIdsDaEliminare
          );

      if (deleteError) {
        throwErroreSupabase(
          "Pulizia lavorazioni precedenti rapporto intervento",
          deleteError
        );
      }
    }

    if (fotoIdsDaEliminare.length > 0) {
      const { error: deleteError } =
        await supabaseClient
          .from("rapporti_intervento_foto")
          .delete()
          .in("id", fotoIdsDaEliminare);

      if (deleteError) {
        throwErroreSupabase(
          "Pulizia foto precedenti rapporto intervento",
          deleteError
        );
      }
    }

    if (materialeIdsDaEliminare.length > 0) {
      const { error: deleteError } =
        await supabaseClient
          .from(
            "rapporti_intervento_materiali"
          )
          .delete()
          .in("id", materialeIdsDaEliminare);

      if (deleteError) {
        throwErroreSupabase(
          "Pulizia materiali precedenti rapporto intervento",
          deleteError
        );
      }
    }
  }

  return {
    ...(data as RapportoIntervento),
    lavorazioni: nuoveLavorazioni,
    foto: nuoveFoto,
    materiali: nuoviMateriali,
  };
}
