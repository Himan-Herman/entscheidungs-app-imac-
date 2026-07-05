/* global self, clients */
/**
 * Push handler for MedScoutX medication reminders.
 *
 * Loaded via workbox `importScripts` into the generated service worker, so it
 * only ADDS two event listeners and never changes the existing caching/offline
 * behavior. The push payload is intentionally generic (no medication names).
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }

  const title = data.title || "MedScoutX";
  const options = {
    body: data.body || "",
    tag: data.tag || "medscoutx-reminder",
    renotify: true,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    silent: data.silent === true,
    data: { url: data.url || "/patient/medication-plans" },
  };
  if (data.vibrate) {
    options.vibrate = [200, 100, 200];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    "/patient/medication-plans";

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("focus" in client) {
          try {
            if ("navigate" in client) await client.navigate(targetUrl);
          } catch (e) {
            /* navigation may be blocked cross-origin — focus anyway */
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })(),
  );
});
