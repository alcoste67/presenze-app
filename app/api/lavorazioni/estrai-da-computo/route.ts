import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import {
  LAVORAZIONI_IMPORT,
  LAVORAZIONI_LIMITI,
  LAVORAZIONI_TESTI,
} from "@/constants/lavorazioni";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import type { LavorazioneImportPreview } from "@/types/lavorazioni";


const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const OPENAI_RESPONSES_URL =
  "https://api.openai.com/v1/responses";

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
      headers: NO_STORE_HEADERS,
    }
  );
}

function jsonOk(payload: unknown) {
  return Response.json(payload, {
    status: HTTP_STATUS.OK,
    headers: NO_STORE_HEADERS,
  });
}

function isCsvFile(
  value: FormDataEntryValue | null
): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "type" in value &&
    "text" in value &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.type === "string" &&
    typeof value.text === "function"
  );
}

function estraiAccessToken(
  request: Request
): string | null {
  const authorization = request.headers.get(
    API_HEADERS.AUTHORIZATION
  );

  if (
    !authorization?.startsWith(
      API_HEADERS.BEARER_PREFIX
    )
  ) {
    return null;
  }

  const accessToken = authorization
    .slice(API_HEADERS.BEARER_PREFIX.length)
    .trim();

  return accessToken || null;
}

function isFileCsv(file: File) {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv"
  );
}

function contaSeparatore(
  riga: string,
  separatore: string
) {
  let conteggio = 0;
  let inVirgolette = false;

  for (let index = 0; index < riga.length; index += 1) {
    const carattere = riga[index];
    const prossimo = riga[index + 1];

    if (carattere === '"' && prossimo === '"') {
      index += 1;
      continue;
    }

    if (carattere === '"') {
      inVirgolette = !inVirgolette;
      continue;
    }

    if (!inVirgolette && carattere === separatore) {
      conteggio += 1;
    }
  }

  return conteggio;
}

function getSeparatoreCsv(righe: string[]) {
  const righeValide = righe
    .filter((riga) => riga.trim())
    .slice(0, 20);

  const puntiEVirgola = righeValide.reduce(
    (totale, riga) =>
      totale + contaSeparatore(riga, ";"),
    0
  );
  const virgole = righeValide.reduce(
    (totale, riga) =>
      totale + contaSeparatore(riga, ","),
    0
  );

  return puntiEVirgola >= virgole ? ";" : ",";
}

function splitRigaCsv(
  riga: string,
  separatore: string
) {
  const celle: string[] = [];
  let cella = "";
  let inVirgolette = false;

  for (let index = 0; index < riga.length; index += 1) {
    const carattere = riga[index];
    const prossimo = riga[index + 1];

    if (carattere === '"' && prossimo === '"') {
      cella += '"';
      index += 1;
      continue;
    }

    if (carattere === '"') {
      inVirgolette = !inVirgolette;
      continue;
    }

    if (!inVirgolette && carattere === separatore) {
      celle.push(cella.trim());
      cella = "";
      continue;
    }

    cella += carattere;
  }

  celle.push(cella.trim());

  return celle;
}

function parseCsvTestuale(csv: string) {
  const righe = csv
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const separatore = getSeparatoreCsv(righe);

  return righe
    .map((riga) =>
      splitRigaCsv(riga, separatore)
        .map((cella) =>
          cella.replace(/\s+/g, " ").trim()
        )
        .filter(Boolean)
    )
    .filter((celle) => celle.length > 0);
}

function getTestoComputoDaCsv(csv: string) {
  const righe = parseCsvTestuale(csv);

  return righe
    .map(
      (celle, index) =>
        `${index + 1}. ${celle.join(" | ")}`
    )
    .join("\n");
}

function getOutputText(
  payload: unknown
): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return null;
  }

  const testi: string[] = [];

  for (const outputItem of payload.output) {
    if (
      !isRecord(outputItem) ||
      !Array.isArray(outputItem.content)
    ) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (
        isRecord(contentItem) &&
        typeof contentItem.text === "string"
      ) {
        testi.push(contentItem.text);
      }
    }
  }

  return testi.join("\n").trim() || null;
}

function isAiLavorazione(
  value: unknown
): value is LavorazioneImportPreview {
  return (
    isRecord(value) &&
    typeof value.nome === "string" &&
    typeof value.ordine === "number" &&
    Number.isInteger(value.ordine)
  );
}

function normalizzaNome(nome: string) {
  return nome.trim().replace(/\s+/g, " ");
}

function getChiaveNome(nome: string) {
  return normalizzaNome(nome).toLowerCase();
}

function normalizzaLavorazioniImport(
  lavorazioni: LavorazioneImportPreview[]
) {
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
      nome,
      ordine: index + 1,
    }));
}

function parseLavorazioniAi(
  outputText: string
) {
  let payload: unknown;

  try {
    payload = JSON.parse(outputText);
  } catch {
    return null;
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.lavorazioni) ||
    !payload.lavorazioni.every(
      isAiLavorazione
    )
  ) {
    return null;
  }

  return normalizzaLavorazioniImport(
    payload.lavorazioni
  );
}

async function estraiLavorazioniConAi(
  testoComputo: string
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      LAVORAZIONI_TESTI.ERRORI
        .AI_NON_CONFIGURATA
    );
  }

  const model =
    process.env.OPENAI_MODEL ||
    LAVORAZIONI_IMPORT.OPENAI_MODEL_DEFAULT;

  const response = await fetch(
    OPENAI_RESPONSES_URL,
    {
      method: "POST",
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${apiKey}`,
        [API_HEADERS.CONTENT_TYPE]:
          API_HEADERS.APPLICATION_JSON,
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions:
          "Estrai da un computo metrico CSV solo lavorazioni o fasi operative di cantiere. Scarta codici, prezzi, misure, importi, totali, descrizioni generiche non operative e duplicati. Rispondi solo con JSON valido conforme allo schema.",
        input: `Computo metrico CSV normalizzato:\n${testoComputo}`,
        text: {
          format: {
            type: "json_schema",
            name: "lavorazioni_computo",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                lavorazioni: {
                  type: "array",
                  maxItems:
                    LAVORAZIONI_LIMITI.IMPORT_MAX_LAVORAZIONI,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      nome: {
                        type: "string",
                      },
                      ordine: {
                        type: "integer",
                      },
                    },
                    required: ["nome", "ordine"],
                  },
                },
              },
              required: ["lavorazioni"],
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const dettaglio = await response.text();
    console.error(
      "Errore OpenAI import lavorazioni",
      dettaglio
    );

    throw new Error(
      LAVORAZIONI_TESTI.ERRORI
        .AI_ESTRAZIONE_FALLITA
    );
  }

  const payload: unknown = await response.json();
  const outputText = getOutputText(payload);

  if (!outputText) {
    throw new Error(
      LAVORAZIONI_TESTI.ERRORI
        .AI_RISPOSTA_NON_VALIDA
    );
  }

  const lavorazioni =
    parseLavorazioniAi(outputText);

  if (!lavorazioni) {
    throw new Error(
      LAVORAZIONI_TESTI.ERRORI
        .AI_RISPOSTA_NON_VALIDA
    );
  }

  return lavorazioni;
}

export async function POST(
  request: Request
): Promise<Response> {
  try {
    const accessToken =
      estraiAccessToken(request);

    if (!accessToken) {
      return jsonErrore(
        LAVORAZIONI_TESTI.ERRORI
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
        LAVORAZIONI_TESTI.ERRORI
          .TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const utenteAdmin = await isAdmin(
      user.email,
      supabaseAdmin
    );

    if (!utenteAdmin) {
      return jsonErrore(
        LAVORAZIONI_TESTI.ERRORI
          .ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return jsonErrore(
        LAVORAZIONI_TESTI.ERRORI
          .FILE_CSV_NON_VALIDO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const file = formData.get("file");

    if (!isCsvFile(file) || !isFileCsv(file)) {
      return jsonErrore(
        LAVORAZIONI_TESTI.ERRORI
          .FILE_CSV_OBBLIGATORIO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const csv = await file.text();

    if (
      csv.length >
      LAVORAZIONI_LIMITI.IMPORT_MAX_CSV_CARATTERI
    ) {
      return jsonErrore(
        LAVORAZIONI_TESTI.ERRORI
          .FILE_CSV_TROPPO_GRANDE,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const testoComputo =
      getTestoComputoDaCsv(csv);

    if (!testoComputo.trim()) {
      return jsonErrore(
        LAVORAZIONI_TESTI.ERRORI
          .FILE_CSV_NON_VALIDO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const lavorazioni =
      await estraiLavorazioniConAi(
        testoComputo
      );

    if (lavorazioni.length === 0) {
      return jsonErrore(
        LAVORAZIONI_TESTI.ERRORI
          .NESSUNA_LAVORAZIONE_IMPORT,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return jsonOk(lavorazioni);
  } catch (error: unknown) {
    console.error(
      "Errore import lavorazioni da computo",
      error
    );

    const messaggioErrore =
      error instanceof Error
        ? error.message
        : LAVORAZIONI_TESTI.ERRORI
            .AI_ESTRAZIONE_FALLITA;

    return jsonErrore(
      messaggioErrore,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
