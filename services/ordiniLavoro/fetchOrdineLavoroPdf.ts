import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS } from "@/constants/api";
import { ORDINI_LAVORO_TESTI } from "@/constants/ordiniLavoro";
import { supabase } from "@/lib/supabase";

type OrdineLavoroPdf = {
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
    return ORDINI_LAVORO_TESTI.ERRORI.PDF_GENERICO;
  }
  return ORDINI_LAVORO_TESTI.ERRORI.PDF_GENERICO;
}

function getNomeFilePdf(response: Response) {
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] || "ordine-lavoro.pdf";
}

export async function fetchOrdineLavoroPdf(
  ordineLavoroId: string
): Promise<OrdineLavoroPdf> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(ORDINI_LAVORO_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const response = await fetch(
    `/api/report/ordine-lavoro-pdf?ordineLavoroId=${encodeURIComponent(ordineLavoroId)}`,
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
