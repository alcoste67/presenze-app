import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS } from "@/constants/api";
import { CHECKLIST_WALLBOX_TESTI } from "@/constants/checklistWallbox";
import { supabase } from "@/lib/supabase";
import type { FormatoChecklistWallbox } from "@/types/checklistWallbox";

export type { FormatoChecklistWallbox };

type ChecklistWallboxPdf = {
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
    return CHECKLIST_WALLBOX_TESTI.ERRORI.PDF_GENERICO;
  }
  return CHECKLIST_WALLBOX_TESTI.ERRORI.PDF_GENERICO;
}

function getNomeFilePdf(response: Response) {
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] || "checklist-wallbox.pdf";
}

export async function fetchChecklistWallboxPdf(
  checklistWallboxId: string,
  formato: FormatoChecklistWallbox = "EDISON"
): Promise<ChecklistWallboxPdf> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(CHECKLIST_WALLBOX_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const response = await fetch(
    `/api/report/checklist-wallbox-pdf?checklistWallboxId=${encodeURIComponent(checklistWallboxId)}&formato=${formato}`,
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
