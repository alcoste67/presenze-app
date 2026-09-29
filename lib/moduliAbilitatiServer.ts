import { MODULI_BACKOFFICE } from "@/constants/moduliBackoffice";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Risolve i moduli backoffice abilitati per un'azienda: parte da tutti
 * abilitati (fail-open), applica il default del piano, poi l'eventuale
 * override puntuale dell'azienda.
 */
export async function risolviModuliAbilitati(
  aziendaId: string,
  piano: string | null
): Promise<string[]> {
  const stato = new Map<string, boolean>();
  for (const modulo of Object.values(MODULI_BACKOFFICE)) {
    stato.set(modulo, true);
  }

  if (piano) {
    const { data: defaultPiano } = await supabaseAdmin
      .from("piano_moduli")
      .select("modulo, abilitato")
      .eq("piano", piano);

    for (const riga of defaultPiano ?? []) {
      stato.set(riga.modulo as string, riga.abilitato as boolean);
    }
  }

  const { data: override } = await supabaseAdmin
    .from("azienda_moduli_override")
    .select("modulo, abilitato")
    .eq("azienda_id", aziendaId);

  for (const riga of override ?? []) {
    stato.set(riga.modulo as string, riga.abilitato as boolean);
  }

  return [...stato.entries()].filter(([, abilitato]) => abilitato).map(([modulo]) => modulo);
}
