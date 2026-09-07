import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:info@cantivo.it";

let configurato = false;

function assicuraConfigurazione() {
  if (configurato) return;

  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID non configurate: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY mancanti"
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configurato = true;
}

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** true se l'invio è riuscito, false se la subscription non è più valida (410/404: va eliminata) */
export async function inviaPush(
  subscription: PushSubscriptionRecord,
  payload: { titolo: string; corpo: string; url?: string }
): Promise<{ ok: true } | { ok: false; scaduta: boolean }> {
  assicuraConfigurazione();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({
        title: payload.titolo,
        body: payload.corpo,
        url: payload.url || "/",
      })
    );
    return { ok: true };
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
    const scaduta = status === 404 || status === 410;
    if (!scaduta) {
      console.error("Errore invio push", error);
    }
    return { ok: false, scaduta };
  }
}
