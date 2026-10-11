/*
 * Companion's service worker. It does one job: show an alert from the family's agent, and open
 * the right screen when it is tapped. It never reads, stores or sends anything else.
 *
 * Served from the site root so it can control the whole app. Payloads are JSON written by the
 * agent: { title, body, footer, url, holdId, familyId }.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Companion", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Companion";
  const body = [data.body, data.footer].filter(Boolean).join("\n\n");
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // One notification per hold, so a second page for the same payment replaces the first.
      tag: data.holdId ? "hold-" + data.holdId : "family-" + (data.familyId || "alert"),
      renotify: true,
      // A parent should not have to hunt for it. It stays until she acts.
      requireInteraction: true,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
