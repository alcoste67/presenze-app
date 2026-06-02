import { HTTP_STATUS } from "@/constants/api";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { TIPO_CONTEGGIO_ORE } from "@/constants/tipoConteggioOre";
import { isRecord } from "@/lib/typeGuards";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI_API = {
  PAYLOAD_NON_VALIDO: "Dati non validi",
  CAMPI_OBBLIGATORI:
    "Nome azienda, nome, cognome ed email sono obbligatori",
  PASSWORD_TROPPO_CORTA:
    "La password deve essere di almeno 8 caratteri",
  PASSWORD_NON_COINCIDONO: "Le password non corrispondono",
  EMAIL_GIA_REGISTRATA:
    "Esiste già un account con questa email",
  ERRORE_GENERICO: "Errore durante la registrazione",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type FormAzienda = {
  nome: string;
  partita_iva: string;
  codice_fiscale: string;
  indirizzo: string;
  email: string;
  telefono: string;
};

type FormAdmin = {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  conferma_password: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonErrore(messaggio: string, status: number) {
  return Response.json({ error: messaggio }, { status });
}

function leggiPayload(
  body: unknown
): { azienda: FormAzienda; admin: FormAdmin } | null {
  if (!isRecord(body)) return null;
  const { azienda, admin } = body;
  if (!isRecord(azienda) || !isRecord(admin)) return null;
  if (
    typeof azienda.nome !== "string" ||
    typeof admin.nome !== "string" ||
    typeof admin.cognome !== "string" ||
    typeof admin.email !== "string" ||
    typeof admin.password !== "string" ||
    typeof admin.conferma_password !== "string"
  )
    return null;

  return {
    azienda: {
      nome: azienda.nome,
      partita_iva:
        typeof azienda.partita_iva === "string" ? azienda.partita_iva : "",
      codice_fiscale:
        typeof azienda.codice_fiscale === "string"
          ? azienda.codice_fiscale
          : "",
      indirizzo:
        typeof azienda.indirizzo === "string" ? azienda.indirizzo : "",
      email: typeof azienda.email === "string" ? azienda.email : "",
      telefono:
        typeof azienda.telefono === "string" ? azienda.telefono : "",
    },
    admin: {
      nome: admin.nome,
      cognome: admin.cognome,
      email: admin.email,
      password: admin.password,
      conferma_password: admin.conferma_password,
    },
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let authUserId: string | null = null;
  let aziendaId: string | null = null;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErrore(
        ERRORI_API.PAYLOAD_NON_VALIDO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const payload = leggiPayload(body);
    if (!payload) {
      return jsonErrore(
        ERRORI_API.PAYLOAD_NON_VALIDO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { azienda, admin } = payload;

    const nomeAzienda = azienda.nome.trim();
    const nomeAdmin = admin.nome.trim();
    const cognomeAdmin = admin.cognome.trim();
    const emailAdmin = admin.email.trim().toLowerCase();

    if (!nomeAzienda || !nomeAdmin || !cognomeAdmin || !emailAdmin) {
      return jsonErrore(
        ERRORI_API.CAMPI_OBBLIGATORI,
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if (admin.password.length < 8) {
      return jsonErrore(
        ERRORI_API.PASSWORD_TROPPO_CORTA,
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if (admin.password !== admin.conferma_password) {
      return jsonErrore(
        ERRORI_API.PASSWORD_NON_COINCIDONO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // 1. Crea utente Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailAdmin,
        password: admin.password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      if (
        authError?.code === "email_exists" ||
        authError?.message?.toLowerCase().includes("already")
      ) {
        return jsonErrore(
          ERRORI_API.EMAIL_GIA_REGISTRATA,
          HTTP_STATUS.CONFLICT
        );
      }
      throw authError ?? new Error("Creazione utente Auth fallita");
    }

    authUserId = authData.user.id;

    // 2. Crea azienda
    const { data: aziendaData, error: aziendaError } = await supabaseAdmin
      .from("aziende")
      .insert({
        nome: nomeAzienda,
        partita_iva: azienda.partita_iva.trim() || null,
        codice_fiscale: azienda.codice_fiscale.trim() || null,
        indirizzo: azienda.indirizzo.trim() || null,
        email: azienda.email.trim() || null,
        telefono: azienda.telefono.trim() || null,
      })
      .select("id")
      .single();

    if (aziendaError || !aziendaData) {
      throw aziendaError ?? new Error("Creazione azienda fallita");
    }

    aziendaId = aziendaData.id as string;

    // 3. Crea dipendente ADMIN
    const { error: dipendenteError } = await supabaseAdmin
      .from("dipendenti")
      .insert({
        nome: nomeAdmin,
        cognome: cognomeAdmin,
        email: emailAdmin,
        ruolo: RUOLI_DIPENDENTE.ADMIN,
        attivo: true,
        tipo_conteggio_ore: TIPO_CONTEGGIO_ORE.REALE,
        auth_user_id: authUserId,
        azienda_id: aziendaId,
      });

    if (dipendenteError) {
      throw dipendenteError;
    }

    return Response.json({ success: true }, { status: HTTP_STATUS.CREATED });
  } catch (error: unknown) {
    // Rollback: prima azienda (dipendente non creato), poi auth user
    if (aziendaId) {
      const { error: delErr } = await supabaseAdmin
        .from("aziende")
        .delete()
        .eq("id", aziendaId);
      if (delErr) console.error("Rollback azienda fallito", delErr);
    }
    if (authUserId) {
      const { error: delErr } =
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      if (delErr) console.error("Rollback auth user fallito", delErr);
    }

    console.error("Errore registrazione azienda", error);

    return Response.json(
      { error: ERRORI_API.ERRORE_GENERICO },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
