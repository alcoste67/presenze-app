import { supabase } from "@/lib/supabase";
import { loadCostiMacchinariCommessa } from "@/services/costiMacchinari/loadCostiMacchinariCommessa";
import { loadMacchinariPubblici } from "@/services/macchinari/loadMacchinariPubblici";
import { loadRapportiInterventoCantiere } from "@/services/commessa/loadRapportiInterventoCantiere";
import { loadSalLavorazioniFoto } from "@/services/sal/loadSalLavorazioniFoto";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";
import type { MacchinarioPubblico } from "@/types/macchinari";
import type {
  CostoMacchinarioCommessa,
  CostoMacchinarioCommessaPubblico,
} from "@/types/costiMacchinari";
import type { RapportoIntervento } from "@/types/rapportiIntervento";
import type {
  SalCantiere,
  SalLavorazioneFoto,
} from "@/types/sal";

type SupabaseClient = typeof supabase;

export type DashboardCommessaData = {
  sal: SalCantiere;
  fotoRecenti: SalLavorazioneFoto[];
  numeroFotoSal: number;
  costiMacchinari: Array<
    | CostoMacchinarioCommessa
    | CostoMacchinarioCommessaPubblico
  >;
  rapportiRecenti: RapportoIntervento[];
  numeroRapportiIntervento: number;
  macchinariPubblici: MacchinarioPubblico[];
};

export async function loadDashboardCommessa({
  cantiereId,
  includeCosti,
  limitFoto = 6,
  limitRapporti = 6,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  includeCosti: boolean;
  limitFoto?: number;
  limitRapporti?: number;
  supabaseClient?: SupabaseClient;
}): Promise<DashboardCommessaData> {
  if (!cantiereId) {
    return {
      sal: {
        cantiereId,
        avanzamentoTotale: 0,
        oreUomoTotaliMinuti: 0,
        lavorazioni: [],
      },
      fotoRecenti: [],
      numeroFotoSal: 0,
      costiMacchinari: [],
      rapportiRecenti: [],
      numeroRapportiIntervento: 0,
      macchinariPubblici: [],
    };
  }

  const [sal, fotoRecenti, costiMacchinari, rapportiRecenti, macchinariPubblici, fotoCountResult, rapportiCountResult] =
    await Promise.all([
      loadSalCantiere(cantiereId, supabaseClient),
      loadSalLavorazioniFoto({
        cantiereId,
        limit: limitFoto,
        supabaseClient,
      }),
      loadCostiMacchinariCommessa({
        cantiereId,
        includeCosti,
        supabaseClient,
      }),
      loadRapportiInterventoCantiere({
        cantiereId,
        limit: limitRapporti,
        supabaseClient,
      }),
      loadMacchinariPubblici({
        supabaseClient,
      }),
      supabaseClient
        .from("sal_lavorazioni_foto")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("cantiere_id", cantiereId),
      supabaseClient
        .from("rapporti_intervento")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("cantiere_id", cantiereId),
    ]);

  if (fotoCountResult.error) {
    throw fotoCountResult.error;
  }

  if (rapportiCountResult.error) {
    throw rapportiCountResult.error;
  }

  return {
    sal,
    fotoRecenti,
    numeroFotoSal: fotoCountResult.count || 0,
    costiMacchinari,
    rapportiRecenti,
    numeroRapportiIntervento:
      rapportiCountResult.count || 0,
    macchinariPubblici,
  };
}
