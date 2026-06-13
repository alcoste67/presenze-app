import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import {
  SAL_FREEZE_ERRORI,
  SalFreezeError,
  calcolaImportiVoce,
  getPercentualePrecedente,
  loadAvanzamentoSubappaltoByVoce,
  loadCollaborazioniFreeze,
  loadFreezePrecedenteLavorazioni,
  loadValorizzazioneLavorazioni,
} from "@/services/salFreeze/createSalFreeze";
import type { SalFreezeMensile } from "@/types/salFreeze";

type SupabaseClient = typeof supabaseAdmin;

const SELECT_FREEZE =
  "id, cantiere_id, freeze_at, azienda_id, annullato_at, stato";

function throwSalFreezeError(
  code: keyof typeof SAL_FREEZE_ERRORI,
  message: string
): never {
  throw new SalFreezeError(SAL_FREEZE_ERRORI[code], message);
}

function normalizzaTesto(value: string) {
  return value.trim().toLowerCase();
}

// Rigenera un SAL periodo in BOZZA: ricalcola da zero le lavorazioni e le
// collaborazioni dagli avanzamenti correnti (sovrascrive eventuali correzioni
// manuali — è il comportamento voluto quando si aggiungono percentuali).
// Mantiene header, foto e macchinari. Vietato se definitivo/annullato.
export async function rigeneraSalFreeze({
  freezeId,
  userEmail,
  supabaseClient = supabaseAdmin,
}: {
  freezeId: string;
  userEmail: string;
  supabaseClient?: SupabaseClient;
}): Promise<SalFreezeMensile> {
  if (!freezeId) {
    throwSalFreezeError("INPUT_NON_VALIDO", "Freeze non valido");
  }

  const utenteAdmin = await isAdmin(userEmail, supabaseAdmin);

  if (!utenteAdmin) {
    throwSalFreezeError("ACCESSO_NEGATO", "Accesso non autorizzato");
  }

  const { data: freeze, error: freezeError } = await supabaseClient
    .from("sal_freeze_mensili")
    .select(SELECT_FREEZE)
    .eq("id", freezeId)
    .maybeSingle();

  if (freezeError) {
    throwErroreSupabase("Lettura SAL periodo da rigenerare", freezeError);
  }

  if (!freeze) {
    throwSalFreezeError("FREEZE_NON_TROVATO", "SAL periodo non trovato");
  }

  if (freeze.annullato_at) {
    throwSalFreezeError("FREEZE_GIA_ANNULLATO", "SAL periodo gia annullato");
  }

  if (freeze.stato === "definitivo") {
    throwSalFreezeError(
      "FREEZE_GIA_DEFINITIVO",
      "SAL periodo definitivo: non rigenerabile"
    );
  }

  const cantiereId: string = freeze.cantiere_id;
  const aziendaId: string = freeze.azienda_id;

  // Freeze precedente = ultimo non annullato dello stesso cantiere con
  // freeze_at anteriore a questo (esclude se stesso).
  const { data: precedente } = await supabaseClient
    .from("sal_freeze_mensili")
    .select("id")
    .eq("cantiere_id", cantiereId)
    .is("annullato_at", null)
    .lt("freeze_at", freeze.freeze_at)
    .order("freeze_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [salLive, valorizzazioneById, collaborazioniRows, avanzamentoSubByVoce] =
    await Promise.all([
      loadSalCantiere(cantiereId, supabaseClient),
      loadValorizzazioneLavorazioni(cantiereId, supabaseClient),
      loadCollaborazioniFreeze(cantiereId, supabaseClient),
      loadAvanzamentoSubappaltoByVoce(cantiereId, supabaseClient),
    ]);

  const precedenteRows = precedente
    ? await loadFreezePrecedenteLavorazioni(precedente.id, supabaseClient)
    : [];

  const freezePrecedenteById = new Map(
    precedenteRows
      .filter((row) => row.lavorazione_id)
      .map((row) => [row.lavorazione_id as string, row])
  );
  const freezePrecedenteByNome = new Map(
    precedenteRows.map((row) => [
      normalizzaTesto(row.lavorazione_nome_snapshot),
      row,
    ])
  );

  const lavorazioniInsert = salLive.lavorazioni.map((lavorazione) => {
    const percentualePrecedente = getPercentualePrecedente({
      lavorazioneId: lavorazione.id,
      lavorazioneNome: lavorazione.nome,
      freezePrecedenteById,
      freezePrecedenteByNome,
    });
    const avanzamentoSub = avanzamentoSubByVoce.get(lavorazione.id);
    const percentualeAttuale =
      avanzamentoSub != null
        ? avanzamentoSub
        : lavorazione.percentuale_completamento;
    const deltaPercentuale = percentualeAttuale - percentualePrecedente;

    const importi = calcolaImportiVoce({
      valorizzazione: valorizzazioneById.get(lavorazione.id),
      percentualeAttuale,
      deltaPercentuale,
    });

    return {
      freeze_id: freezeId,
      lavorazione_id: lavorazione.id,
      lavorazione_nome_snapshot: lavorazione.nome,
      percentuale_precedente: percentualePrecedente,
      percentuale_attuale: percentualeAttuale,
      delta_percentuale: deltaPercentuale,
      ore_uomo_minuti: lavorazione.oreUomoMinuti,
      ordine: lavorazione.ordine,
      azienda_id: aziendaId,
      ...importi,
    };
  });

  const collaborazioniInsert = collaborazioniRows.map((r, index) => ({
    freeze_id: freezeId,
    azienda_id: aziendaId,
    azienda_collaboratrice_nome: r.azienda_collaboratrice_nome,
    cantiere_collaboratore_nome: r.cantiere_collaboratore_nome,
    lavorazione_nome: r.lavorazione_nome,
    percentuale_completamento: r.percentuale_completamento,
    ordine: index,
  }));

  // Sostituzione atomica-per-tabella: cancella le righe vecchie e reinserisce.
  // Consentito perché il freeze è 'bozza' (il trigger di lock blocca solo i
  // definitivi).
  const { error: delLavError } = await supabaseClient
    .from("sal_freeze_lavorazioni")
    .delete()
    .eq("freeze_id", freezeId);

  if (delLavError) {
    throwErroreSupabase("Rigenerazione: pulizia lavorazioni", delLavError);
  }

  if (lavorazioniInsert.length > 0) {
    const { error } = await supabaseClient
      .from("sal_freeze_lavorazioni")
      .insert(lavorazioniInsert);

    if (error) {
      throwErroreSupabase("Rigenerazione: insert lavorazioni", error);
    }
  }

  const { error: delCollabError } = await supabaseClient
    .from("sal_freeze_collaborazioni")
    .delete()
    .eq("freeze_id", freezeId);

  if (delCollabError) {
    throwErroreSupabase("Rigenerazione: pulizia collaborazioni", delCollabError);
  }

  if (collaborazioniInsert.length > 0) {
    const { error } = await supabaseClient
      .from("sal_freeze_collaborazioni")
      .insert(collaborazioniInsert);

    if (error) {
      throwErroreSupabase("Rigenerazione: insert collaborazioni", error);
    }
  }

  const { data: freezeAggiornato, error: updateError } = await supabaseClient
    .from("sal_freeze_mensili")
    .update({ freeze_at: new Date().toISOString() })
    .eq("id", freezeId)
    .eq("stato", "bozza")
    .is("annullato_at", null)
    .select(
      "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by, stato, confermato_at, confermato_by"
    )
    .single();

  if (updateError) {
    throwErroreSupabase("Rigenerazione: aggiornamento header", updateError);
  }

  return freezeAggiornato as SalFreezeMensile;
}
