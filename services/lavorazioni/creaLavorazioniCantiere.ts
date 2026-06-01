import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import {
  LAVORAZIONI_LIMITI,
} from "@/constants/lavorazioni";
import type {
  LavorazioneCantiere,
  LavorazioneImportPreview,
} from "@/types/lavorazioni";

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, created_at";

type Params = {
  cantiereId: string;
  lavorazioni: LavorazioneImportPreview[];
  ordineIniziale: number;
};

function normalizzaNome(nome: string) {
  return nome.trim().replace(/\s+/g, " ");
}

function getChiaveNome(nome: string) {
  return normalizzaNome(nome).toLowerCase();
}

function preparaLavorazioni({
  cantiereId,
  lavorazioni,
  ordineIniziale,
  aziendaId,
}: Params & { aziendaId: string }) {
  const nomiUsati = new Set<string>();

  return [...lavorazioni]
    .sort((a, b) => a.ordine - b.ordine)
    .map((lavorazione) =>
      normalizzaNome(lavorazione.nome)
    )
    .filter((nome) => {
      const chiave = getChiaveNome(nome);

      if (!chiave || nomiUsati.has(chiave)) {
        return false;
      }

      nomiUsati.add(chiave);
      return true;
    })
    .slice(
      0,
      LAVORAZIONI_LIMITI.IMPORT_MAX_LAVORAZIONI
    )
    .map((nome, index) => ({
      cantiere_id: cantiereId,
      nome,
      ordine: ordineIniziale + index,
      attiva: true,
      percentuale_completamento:
        LAVORAZIONI_LIMITI.PERCENTUALE_MIN,
      azienda_id: aziendaId,
    }));
}

export async function creaLavorazioniCantiere({
  cantiereId,
  lavorazioni,
  ordineIniziale,
}: Params): Promise<LavorazioneCantiere[]> {
  if (!cantiereId) {
    return [];
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabase,
    user.id
  );

  const righe = preparaLavorazioni({
    cantiereId,
    lavorazioni,
    ordineIniziale,
    aziendaId,
  });

  if (righe.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("lavorazioni_cantiere")
    .insert(righe)
    .select(SELECT_LAVORAZIONE_CANTIERE);

  if (error) {
    throw error;
  }

  return (data || []) as LavorazioneCantiere[];
}
