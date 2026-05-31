import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { RAPPORTI_INTERVENTO_TESTI } from "@/constants/rapportiIntervento";
import { supabase } from "@/lib/supabase";

type RapportoInterventoPdf = {
  blob: Blob;
  nomeFile: string;
};

async function leggiMessaggioErrorePdf(
  response: Response
) {
  try {
    const payload = await response.json();

    if (
      isRecord(payload) &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    return RAPPORTI_INTERVENTO_TESTI.ERRORI
      .PDF_GENERICO;
  }

  return RAPPORTI_INTERVENTO_TESTI.ERRORI
    .PDF_GENERICO;
}

function getNomeFilePdf(response: Response) {
  const contentDisposition =
    response.headers.get("Content-Disposition") ||
    "";
  const match = /filename="([^"]+)"/.exec(
    contentDisposition
  );

  return (
    match?.[1] ||
    RAPPORTI_INTERVENTO_TESTI.PDF_NOME_DEFAULT
  );
}

export async function fetchRapportoInterventoPdf(
  rapportoInterventoId: string
): Promise<RapportoInterventoPdf> {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      RAPPORTI_INTERVENTO_TESTI.ERRORI
        .SESSIONE_MANCANTE
    );
  }

  const response = await fetch(
    `${API_ROUTES.REPORT_RAPPORTO_INTERVENTO_PDF}?rapportoInterventoId=${encodeURIComponent(rapportoInterventoId)}`,
    {
      headers: {
        [API_HEADERS.AUTHORIZATION]:
          `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      await leggiMessaggioErrorePdf(response)
    );
  }

  return {
    blob: await response.blob(),
    nomeFile: getNomeFilePdf(response),
  };
}
