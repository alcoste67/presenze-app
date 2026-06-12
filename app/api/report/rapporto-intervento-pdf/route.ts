import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import {
  RAPPORTI_INTERVENTO_PDF,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isDipendenteAttivoSupabase } from "@/services/dipendenti/isDipendenteAttivoSupabase";
import { loadRapportoIntervento } from "@/services/rapportiIntervento/loadRapportoIntervento";
import {
  generaRapportoInterventoPdf,
  getNomeFile,
} from "@/services/rapportiIntervento/pdf/generaPdfRapporto";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(
  error: string,
  status: number
) {
  return Response.json(
    {
      error,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

export async function GET(request: NextRequest) {
  const rapportoInterventoId =
    request.nextUrl.searchParams.get(
      "rapportoInterventoId"
    ) || "";

  try {
    if (!rapportoInterventoId) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .RAPPORTO_NON_TROVATO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const accessToken =
      estraiBearerToken(request);

    if (!accessToken) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (authError || !user?.email) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const utenteAdmin = await isAdmin(
      user.email,
      supabaseAdmin
    );

    const dipendenteAttivo = utenteAdmin
      ? true
      : await isDipendenteAttivoSupabase(
          user.email,
          supabaseAdmin
        );

    if (!utenteAdmin && !dipendenteAttivo) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const rapporto =
      await loadRapportoIntervento(
        rapportoInterventoId,
        supabaseAdmin
      );

    if (!rapporto) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .RAPPORTO_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const pdfBytes =
      await generaRapportoInterventoPdf(
        rapporto,
        {
          mostraFatturazione: utenteAdmin,
        }
      );
    const fileName = getNomeFile(rapporto);
    const pdfBuffer = new ArrayBuffer(
      pdfBytes.byteLength
    );
    const pdfView = new Uint8Array(pdfBuffer);

    pdfView.set(pdfBytes);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type":
          RAPPORTI_INTERVENTO_PDF.CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error(
      "Errore generazione PDF rapporto intervento",
      {
        rapportoInterventoId,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        stack:
          error instanceof Error
            ? error.stack
            : undefined,
        error,
      }
    );

    return jsonErrore(
      RAPPORTI_INTERVENTO_TESTI.ERRORI
        .PDF_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
