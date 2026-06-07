import { HTTP_STATUS } from "@/constants/api";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { TIPO_CONTEGGIO_ORE } from "@/constants/tipoConteggioOre";
import { isRecord } from "@/lib/typeGuards";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI_API = {
  PAYLOAD_NON_VALIDO: "Dati non validi",
  CAMPI_OBBLIGATORI: "Nome azienda, nome, cognome ed email sono obbligatori",
  GDPR_OBBLIGATORIO: "Devi accettare la Privacy Policy per continuare",
  EMAIL_GIA_REGISTRATA: "Email già registrata. Accedi con questa email.",
  ERRORE_GENERICO: "Errore durante la registrazione",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type FormAzienda = {
  nome: string;
  forma_societaria: string;
  partita_iva: string;
  codice_fiscale: string;
  sede_legale_via: string;
  sede_legale_cap: string;
  sede_legale_citta: string;
  sede_legale_provincia: string;
  email: string;
  pec: string;
  codice_sdi: string;
  telefono: string;
  sito_web: string;
};

type FormAdmin = {
  nome: string;
  cognome: string;
  email: string;
};

type Payload = {
  azienda: FormAzienda;
  admin: FormAdmin;
  gdpr_marketing: boolean;
  gdpr_terzi: boolean;
  // TODO: re-enable Turnstile captcha before go-live
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonErrore(messaggio: string, status: number) {
  return Response.json({ error: messaggio }, { status });
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function leggiPayload(body: unknown): Payload | null {
  if (!isRecord(body)) return null;
  const { azienda, admin } = body;
  if (!isRecord(azienda) || !isRecord(admin)) return null;
  if (
    typeof azienda.nome !== "string" ||
    typeof admin.nome !== "string" ||
    typeof admin.cognome !== "string" ||
    typeof admin.email !== "string"
  )
    return null;

  return {
    azienda: {
      nome: azienda.nome,
      forma_societaria: typeof azienda.forma_societaria === "string" ? azienda.forma_societaria : "",
      partita_iva: typeof azienda.partita_iva === "string" ? azienda.partita_iva : "",
      codice_fiscale: typeof azienda.codice_fiscale === "string" ? azienda.codice_fiscale : "",
      sede_legale_via: typeof azienda.sede_legale_via === "string" ? azienda.sede_legale_via : "",
      sede_legale_cap: typeof azienda.sede_legale_cap === "string" ? azienda.sede_legale_cap : "",
      sede_legale_citta: typeof azienda.sede_legale_citta === "string" ? azienda.sede_legale_citta : "",
      sede_legale_provincia: typeof azienda.sede_legale_provincia === "string" ? azienda.sede_legale_provincia : "",
      email: typeof azienda.email === "string" ? azienda.email : "",
      pec: typeof azienda.pec === "string" ? azienda.pec : "",
      codice_sdi: typeof azienda.codice_sdi === "string" ? azienda.codice_sdi : "0000000",
      telefono: typeof azienda.telefono === "string" ? azienda.telefono : "",
      sito_web: typeof azienda.sito_web === "string" ? azienda.sito_web : "",
    },
    admin: {
      nome: admin.nome,
      cognome: admin.cognome,
      email: admin.email,
    },
    gdpr_marketing: body.gdpr_marketing === true,
    gdpr_terzi: body.gdpr_terzi === true,
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
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    console.log("[registra-azienda] STEP 1: parsing payload");
    const payload = leggiPayload(body);
    if (!payload) {
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    const { azienda, admin } = payload;

    const nomeAzienda = azienda.nome.trim();
    const nomeAdmin = admin.nome.trim();
    const cognomeAdmin = admin.cognome.trim();
    const emailAdmin = admin.email.trim().toLowerCase();

    if (!nomeAzienda || !nomeAdmin || !cognomeAdmin || !emailAdmin) {
      return jsonErrore(ERRORI_API.CAMPI_OBBLIGATORI, HTTP_STATUS.BAD_REQUEST);
    }

    const randomPassword =
      globalThis.crypto.randomUUID() + "-" + globalThis.crypto.randomUUID();

    console.log("[registra-azienda] STEP 2: createUser starting", { email: emailAdmin });
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailAdmin,
        password: randomPassword,
        email_confirm: true, // email già confermata — primo contatto sarà l'OTP al login
      });

    console.log("[registra-azienda] STEP 2 result:", {
      userId: authData?.user?.id ?? null,
      error: authError ? JSON.stringify(authError) : null,
    });

    if (authError || !authData.user) {
      const msg = authError?.message?.toLowerCase() ?? "";
      const isEmailExists =
        authError?.code === "email_exists" ||
        msg.includes("already") ||
        msg.includes("email exists") ||
        msg.includes("already registered");
      if (isEmailExists) {
        return jsonErrore(ERRORI_API.EMAIL_GIA_REGISTRATA, HTTP_STATUS.BAD_REQUEST);
      }
      throw authError ?? new Error("Creazione utente Auth fallita");
    }

    authUserId = authData.user.id;

    console.log("[registra-azienda] STEP 3: insert azienda starting");
    const { data: aziendaData, error: aziendaError } = await supabaseAdmin
      .from("aziende")
      .insert({
        nome: nomeAzienda,
        forma_societaria: strOrNull(azienda.forma_societaria),
        partita_iva: strOrNull(azienda.partita_iva),
        codice_fiscale: strOrNull(azienda.codice_fiscale),
        sede_legale_via: strOrNull(azienda.sede_legale_via),
        sede_legale_cap: strOrNull(azienda.sede_legale_cap),
        sede_legale_citta: strOrNull(azienda.sede_legale_citta),
        sede_legale_provincia: strOrNull(azienda.sede_legale_provincia),
        email: strOrNull(azienda.email),
        pec: strOrNull(azienda.pec),
        codice_sdi: strOrNull(azienda.codice_sdi) ?? "0000000",
        telefono: strOrNull(azienda.telefono),
        sito_web: strOrNull(azienda.sito_web),
      })
      .select("id")
      .single();

    if (aziendaError || !aziendaData) {
      console.error("[registra-azienda] INSERT aziende error:", JSON.stringify(aziendaError, null, 2));
      throw aziendaError ?? new Error("Creazione azienda fallita");
    }

    aziendaId = aziendaData.id as string;

    console.log("[registra-azienda] STEP 4: insert dipendente starting", { aziendaId });
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
        gdpr_marketing: payload.gdpr_marketing,
        gdpr_terzi: payload.gdpr_terzi,
      });

    if (dipendenteError) {
      console.error("[registra-azienda] INSERT dipendenti error:", JSON.stringify(dipendenteError, null, 2));
      throw dipendenteError;
    }

    console.log("[registra-azienda] success");
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
