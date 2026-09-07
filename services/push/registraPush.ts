import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((carattere) => carattere.charCodeAt(0)));
}

export function pushSupportata(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function autenticazioneHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione mancante");
  return {
    [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
    [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
  };
}

/** Chiede il permesso e attiva le notifiche push per questo dispositivo. */
export async function attivaPromemoriaPush(): Promise<void> {
  if (!pushSupportata()) {
    throw new Error("Notifiche non supportate su questo dispositivo/browser");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Notifiche non configurate");
  }

  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") {
    throw new Error("Permesso notifiche non concesso");
  }

  const registrazione = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const subscription = await registrazione.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  const headers = await autenticazioneHeaders();
  const risposta = await fetch(API_ROUTES.PUSH_SUBSCRIBE, {
    method: "POST",
    headers,
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!risposta.ok) {
    throw new Error("Errore salvataggio promemoria push");
  }
}

/** Disattiva le notifiche push su questo dispositivo. */
export async function disattivaPromemoriaPush(): Promise<void> {
  if (!pushSupportata()) return;

  const registrazione = await navigator.serviceWorker.getRegistration();
  const subscription = await registrazione?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const headers = await autenticazioneHeaders();
  await fetch(API_ROUTES.PUSH_UNSUBSCRIBE, {
    method: "POST",
    headers,
    body: JSON.stringify({ endpoint }),
  });
}

/** Stato attuale del permesso notifiche (per decidere se mostrare il banner). */
export function statoPermessoPush(): NotificationPermission | "non-supportato" {
  if (!pushSupportata()) return "non-supportato";
  return Notification.permission;
}
