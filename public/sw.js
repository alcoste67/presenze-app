// Service worker minimo: solo per ricevere le push dei promemoria di
// timbratura. Nessun caching offline (non è lo scopo di questo file).

self.addEventListener("push", (event) => {
  let dati = { title: "Cantivo", body: "Promemoria timbratura", url: "/" };
  try {
    if (event.data) dati = { ...dati, ...event.data.json() };
  } catch {
    // payload non JSON: usa i default
  }

  event.waitUntil(
    self.registration.showNotification(dati.title, {
      body: dati.body,
      icon: "/cantivo-logo.png",
      badge: "/cantivo-logo.png",
      data: { url: dati.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
