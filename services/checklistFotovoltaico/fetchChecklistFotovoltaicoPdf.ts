import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS } from "@/constants/api";
import { CHECKLIST_FOTOVOLTAICO_TESTI } from "@/constants/checklistFotovoltaico";
import { supabase } from "@/lib/supabase";

type ChecklistFotovoltaicoPdf = {
  blob: Blob;
  nomeFile: string;
};

async function leggiMessaggioErrorePdf(response: Response) {
  try {
    const payload = await response.json();
    if (isRecord(payload) && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    return CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.PDF_GENERICO;
  }
  return CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.PDF_GENERICO;
}

function getNomeFilePdf(response: Response) {
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] || "checklist-fotovoltaico.pdf";
}

export async function fetchChecklistFotovoltaicoPdf(
  checklistFotovoltaicoId: string
): Promise<ChecklistFotovoltaicoPdf> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const response = await fetch(
    `/api/report/checklist-fotovoltaico-pdf?checklistFotovoltaicoId=${encodeURIComponent(checklistFotovoltaicoId)}`,
    {
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(await leggiMessaggioErrorePdf(response));
  }

  return {
    blob: await response.blob(),
    nomeFile: getNomeFilePdf(response),
  };
}
