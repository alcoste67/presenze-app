import { supabaseAdmin } from "@/lib/supabaseAdmin";

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const ERRORI_API = {
  PAYLOAD_NON_VALIDO: "Email non valida",
  ERRORE_GENERICO:
    "Errore verifica dipendente attivo",
} as const;

function jsonErrore(
  errore: string,
  status: number
) {
  return Response.json(
    {
      errore,
    },
    {
      status,
    }
  );
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function leggiEmail(
  request: Request
): Promise<string | null> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (
    !isRecord(payload) ||
    typeof payload.email !== "string"
  ) {
    return null;
  }

  const email = payload.email
    .trim()
    .toLowerCase();

  return email || null;
}

export async function POST(
  request: Request
): Promise<Response> {
  try {
    const email = await leggiEmail(request);

    if (!email) {
      return jsonErrore(
        ERRORI_API.PAYLOAD_NON_VALIDO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { data, error } = await supabaseAdmin
      .from("dipendenti")
      .select("id")
      .ilike("email", email)
      .eq("attivo", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Response.json(
      {
        attivo: Boolean(data),
      },
      {
        status: HTTP_STATUS.OK,
      }
    );
  } catch (error: unknown) {
    console.error(
      "Errore verifica dipendente attivo",
      error
    );

    return jsonErrore(
      ERRORI_API.ERRORE_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
