import { Resend } from "resend";

import { HTTP_STATUS } from "@/constants/api";
import { CHECKLIST_WALLBOX_LIMITI, CHECKLIST_WALLBOX_STATI } from "@/constants/checklistWallbox";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/typeGuards";

export const runtime = "nodejs";

const MITTENTE = "Cantivo <rapporti@cantivo.it>";
const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

function baseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const host = request.headers.get("host");
  return host ? `https://${host}` : "https://cantivo.it";
}

export async function POST(request: Request): Promise<Response> {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) {
    return jsonErrore("Token mancante", HTTP_STATUS.UNAUTHORIZED);
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !user?.email) {
    return jsonErrore("Token non valido", HTTP_STATUS.UNAUTHORIZED);
  }

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("azienda_id, ruolo, attivo")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  const ruoliAbilitati = ["ADMIN", "SUPERADMIN", "RESPONSABILE"];
  if (!dipendente || !ruoliAbilitati.includes(dipendente.ruolo)) {
    return jsonErrore("Accesso non autorizzato", HTTP_STATUS.FORBIDDEN);
  }

  const aziendaId = dipendente.azienda_id as string;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErrore("Input non valido", HTTP_STATUS.BAD_REQUEST);
  }
  if (
    !isRecord(body) ||
    typeof body.checklistWallboxId !== "string" ||
    typeof body.firmaTecnicoDataUrl !== "string" ||
    !body.firmaTecnicoDataUrl.startsWith("data:image/") ||
    typeof body.firmaTecnicoNome !== "string" ||
    !body.firmaTecnicoNome.trim()
  ) {
    return jsonErrore("Input non valido", HTTP_STATUS.BAD_REQUEST);
  }

  const checklistId = body.checklistWallboxId;
  const firmaTecnicoDataUrl = body.firmaTecnicoDataUrl;
  const firmaTecnicoNome = body.firmaTecnicoNome.trim();
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : null;

  if (
    firmaTecnicoDataUrl.length >
    CHECKLIST_WALLBOX_LIMITI.FIRMA_MAX_DATA_URL_CARATTERI
  ) {
    return jsonErrore("Firma troppo grande", HTTP_STATUS.BAD_REQUEST);
  }

  // ── Checklist: deve esistere, essere della stessa azienda e in BOZZA ──
  const { data: checklist, error: checklistError } = await supabaseAdmin
    .from("checklist_wallbox")
    .select(
      "id, azienda_id, stato, ragione_sociale, nome, cognome, comune, email_cliente"
    )
    .eq("id", checklistId)
    .maybeSingle();

  if (checklistError || !checklist) {
    return jsonErrore("Checklist non trovata", HTTP_STATUS.NOT_FOUND);
  }
  if (checklist.azienda_id !== aziendaId) {
    return jsonErrore("Accesso non autorizzato", HTTP_STATUS.FORBIDDEN);
  }
  if (checklist.stato !== CHECKLIST_WALLBOX_STATI.BOZZA) {
    return jsonErrore(
      "La checklist non è in bozza: firma remota non disponibile",
      HTTP_STATUS.CONFLICT
    );
  }

  // ── Salva la firma tecnico (resta BOZZA finché il cliente non firma) ──
  const { error: updateError } = await supabaseAdmin
    .from("checklist_wallbox")
    .update({
      firma_tecnico_data_url: firmaTecnicoDataUrl,
      firma_tecnico_nome: firmaTecnicoNome,
      firma_tecnico_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", checklistId)
    .eq("stato", CHECKLIST_WALLBOX_STATI.BOZZA);

  if (updateError) {
    return jsonErrore(
      "Salvataggio firma tecnico fallito",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  // ── Annulla eventuali token in attesa precedenti per la stessa checklist ──
  await supabaseAdmin
    .from("checklist_wallbox_firma_remota")
    .update({ stato: "annullato" })
    .eq("checklist_wallbox_id", checklistId)
    .eq("stato", "in_attesa");

  const { data: creato, error: insertError } = await supabaseAdmin
    .from("checklist_wallbox_firma_remota")
    .insert({
      checklist_wallbox_id: checklistId,
      azienda_id: aziendaId,
      email_destinatario: email,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !creato) {
    return jsonErrore(
      "Creazione firma remota fallita",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  const link = `${baseUrl(request)}/checklist-wallbox/firma-remota/${creato.id}`;

  const destinatario = email || checklist.email_cliente || null;
  const nomeCliente =
    checklist.ragione_sociale?.trim() ||
    `${checklist.nome} ${checklist.cognome}`.trim();

  // Email (best-effort): non blocca se manca il destinatario o Resend fallisce
  let emailInviata = false;
  if (destinatario) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: MITTENTE,
          to: destinatario,
          subject: `Firma la checklist wallbox — ${checklist.comune || nomeCliente}`,
          html: `<p>Gentile ${nomeCliente || "cliente"},</p><p>è disponibile la checklist di sopralluogo per l'installazione della wallbox da firmare.</p><p><a href="${link}">Apri e firma la checklist</a></p><p>Il link è valido 14 giorni.</p>`,
        });
        emailInviata = true;
      }
    } catch (e) {
      console.error("[checklist-wallbox/firma-remota] invio email fallito", e);
    }
  }

  return Response.json(
    { token: creato.id, link, emailInviata },
    { status: HTTP_STATUS.CREATED, headers: NO_STORE }
  );
}
