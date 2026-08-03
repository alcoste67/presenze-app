import { Resend } from "resend";

import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { RAPPORTI_INTERVENTO_STATI } from "@/constants/rapportiIntervento";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { isRecord } from "@/lib/typeGuards";

export const runtime = "nodejs";

const MITTENTE = "Cantivo <rapporti@cantivo.it>";
const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

function estraiToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

function baseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const host = request.headers.get("host");
  return host ? `https://${host}` : "https://cantivo.it";
}

export async function POST(request: Request): Promise<Response> {
  const accessToken = estraiToken(request);
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

  const utenteAdmin = await isAdmin(user.email, supabaseAdmin);
  const abilitato = utenteAdmin || (await isResponsabile(user.email, supabaseAdmin));
  if (!abilitato) {
    return jsonErrore("Accesso non autorizzato", HTTP_STATUS.FORBIDDEN);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErrore("Input non valido", HTTP_STATUS.BAD_REQUEST);
  }
  if (!isRecord(body) || typeof body.rapportoInterventoId !== "string") {
    return jsonErrore("Input non valido", HTTP_STATUS.BAD_REQUEST);
  }
  const rapportoId = body.rapportoInterventoId.trim();
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : null;

  const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

  // Il rapporto deve esistere, essere della stessa azienda, in BOZZA e con la
  // firma del responsabile già presente (il cliente firma solo la sua parte).
  const { data: rapporto, error: rapportoError } = await supabaseAdmin
    .from("rapporti_intervento")
    .select(
      "id, azienda_id, stato, cliente_committente, cliente_id, cantiere_nome_snapshot, data_intervento, firma_responsabile_data_url"
    )
    .eq("id", rapportoId)
    .maybeSingle();

  if (rapportoError || !rapporto) {
    return jsonErrore("Rapporto non trovato", HTTP_STATUS.NOT_FOUND);
  }
  if (rapporto.azienda_id !== aziendaId) {
    return jsonErrore("Accesso non autorizzato", HTTP_STATUS.FORBIDDEN);
  }
  if (rapporto.stato !== RAPPORTI_INTERVENTO_STATI.BOZZA) {
    return jsonErrore(
      "Il rapporto non è in bozza: firma remota non disponibile",
      HTTP_STATUS.CONFLICT
    );
  }
  if (!rapporto.firma_responsabile_data_url) {
    return jsonErrore(
      "Firma il rapporto come responsabile prima di inviarlo per la firma remota",
      HTTP_STATUS.CONFLICT
    );
  }

  // Annulla eventuali token in attesa precedenti per lo stesso rapporto
  await supabaseAdmin
    .from("rapporti_firma_remota")
    .update({ stato: "annullato" })
    .eq("rapporto_intervento_id", rapportoId)
    .eq("stato", "in_attesa");

  const { data: creato, error: insertError } = await supabaseAdmin
    .from("rapporti_firma_remota")
    .insert({
      rapporto_intervento_id: rapportoId,
      azienda_id: aziendaId,
      email_destinatario: email,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !creato) {
    return jsonErrore("Creazione firma remota fallita", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  const link = `${baseUrl(request)}/firma-remota/${creato.id}`;

  // Se non passata, usa l'email del cliente in anagrafica
  let destinatario = email;
  if (!destinatario && rapporto.cliente_id) {
    const { data: cliente } = await supabaseAdmin
      .from("clienti")
      .select("email")
      .eq("id", rapporto.cliente_id)
      .maybeSingle();
    if (cliente?.email) destinatario = cliente.email as string;
  }

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
          subject: `Firma il rapporto di lavoro — ${rapporto.cantiere_nome_snapshot}`,
          html: `<p>Gentile ${rapporto.cliente_committente},</p><p>è disponibile il rapporto di lavoro (${rapporto.cantiere_nome_snapshot}, ${rapporto.data_intervento}) da firmare.</p><p><a href="${link}">Apri e firma il rapporto</a></p><p>Il link è valido 14 giorni.</p>`,
        });
        emailInviata = true;
      }
    } catch (e) {
      console.error("[firma-remota] invio email fallito", e);
    }
  }

  return Response.json(
    { token: creato.id, link, emailInviata },
    { status: HTTP_STATUS.CREATED, headers: NO_STORE }
  );
}
