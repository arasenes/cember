// Çember: arka planda gelen bildirimleri gösterir
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }
  e.waitUntil((async () => {
    // Uygulama ekranda açıksa içeride zaten görünüyor; ayrıca bildirim gösterme
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (pencereler.some((c) => c.visibilityState === "visible")) return;
    await self.registration.showNotification(d.baslik || "Çember", {
      body: d.govde || "Yeni mesaj",
      icon: "/ikon.svg",
      badge: "/ikon.svg",
      tag: d.kanal_id || "cember",
      renotify: true,
      data: { kanal_id: d.kanal_id || null },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of pencereler) {
      if ("focus" in c) return c.focus();
    }
    return self.clients.openWindow("/");
  })());
});
