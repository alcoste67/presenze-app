import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import {
  SAL_FREEZE_ERRORI,
  SalFreezeError,
} from "@/services/salFreeze/createSalFreeze";
import type { SalFreezeLavorazione } from "@/types/salFreeze";

type SupabaseClient = typeof supabaseAdmin;

const SELECT_RIGA =
  "id, freeze_id, lavorazione_id, lavorazione_nome_snapshot, percentuale_precedente, percentuale_attuale, delta_percentuale, ore_uomo_minuti, ordine, created_at, unita_misura_snapshot, quantita_snapshot, prezzo_unitario_snapshot, importo_totale, importo_maturato, importo_periodo";

function throwSalFreezeError(
  code: keyof typeof SAL_FREEZE_ERRORI,
  message: string
): never {
  throw new SalFreezeError(SAL_FREEZE_ERRORI[code], message);
}

function arrotonda2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Correzione manuale di una riga del SAL periodo, consentita solo in BOZZA.
// - percentualeAttuale: ricalcola delta e (se la voce è valorizzata) gli importi.
// - importoMaturato / importoPeriodo: override esplicito che prevale sul calcolo.
// Il lock DB blocca comunque qualunque modifica se il freeze è definitivo.
export async function aggiornaSalFreezeLavorazione({
  rigaId,
  percentualeAttuale,
  importoMaturato,
  importoPeriodo,
  userEmail,
  supabaseClient = supabaseAdmin,
}: {
  rigaId: string;
  percentualeAttuale?: number | null;
  importoMaturato?: number | null;
  importoPeriodo?: number | null;
  userEmail: string;
  supabaseClient?: SupabaseClient;
}): Promise<SalFreezeLavorazione> {
  if (!rigaId) {
    throwSalFreezeError("INPUT_NON_VALIDO", "Riga non valida");
  }

  const utenteAdmin = await isAdmin(userEmail, supabaseAdmin);

  if (!utenteAdmin) {
    throwSalFreezeError("ACCESSO_NEGATO", "Accesso non autorizzato");
  }

  const { data: riga, error: rigaError } = await supabaseClient
    .from("sal_freeze_lavorazioni")
    .select(SELECT_RIGA)
    .eq("id", rigaId)
    .maybeSingle();

  if (rigaError) {
    throwErroreSupabase("Lettura riga SAL periodo", rigaError);
  }

  if (!riga) {
    throwSalFreezeError("FREEZE_NON_TROVATO", "Riga SAL periodo non trovata");
  }

  // Controllo stato bozza (oltre al lock DB) per messaggio chiaro
  const { data: header } = await supabaseClient
    .from("sal_freeze_mensili")
    .select("stato, annullato_at")
    .eq("id", riga.freeze_id)
    .maybeSingle();

  if (header?.annullato_at) {
    throwSalFreezeError("FREEZE_GIA_ANNULLATO", "SAL periodo annullato");
  }

  if (header?.stato === "definitivo") {
    throwSalFreezeError(
      "FREEZE_GIA_DEFINITIVO",
      "SAL periodo definitivo: non modificabile"
    );
  }

  const update: Record<string, number | null> = {};

  const importoTotale: number | null = riga.importo_totale;

  if (percentualeAttuale != null) {
    const attuale = Math.max(0, Math.min(100, Math.round(percentualeAttuale)));
    const precedente: number = riga.percentuale_precedente ?? 0;
    const delta = attuale - precedente;

    update.percentuale_attuale = attuale;
    update.delta_percentuale = delta;

    if (importoTotale != null) {
      update.importo_maturato = arrotonda2((importoTotale * attuale) / 100);
      update.importo_periodo = arrotonda2((importoTotale * delta) / 100);
    }
  }

  // Override manuali: prevalgono sul calcolo automatico
  if (importoMaturato !== undefined) {
    update.importo_maturato =
      importoMaturato == null ? null : arrotonda2(importoMaturato);
  }

  if (importoPeriodo !== undefined) {
    update.importo_periodo =
      importoPeriodo == null ? null : arrotonda2(importoPeriodo);
  }

  if (Object.keys(update).length === 0) {
    return riga as SalFreezeLavorazione;
  }

  const { data: rigaAggiornata, error: updateError } = await supabaseClient
    .from("sal_freeze_lavorazioni")
    .update(update)
    .eq("id", rigaId)
    .select(SELECT_RIGA)
    .single();

  if (updateError) {
    throwErroreSupabase("Aggiornamento riga SAL periodo", updateError);
  }

  return rigaAggiornata as SalFreezeLavorazione;
}
