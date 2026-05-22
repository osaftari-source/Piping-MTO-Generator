const CACHE_NAME = "pim-mto-v2-4";
const LEGACY_CACHES_TO_AUTO_UPGRADE = ["pim-mto-v2-3", "pim-mto-v2-2"];
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    await caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS));
    const keys = await caches.keys();
    // One-time bridge: previous PIM MTO versions had no in-app update prompt.
    if (LEGACY_CACHES_TO_AUTO_UPGRADE.some(key => keys.includes(key))) {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keysBeforeCleanup = await caches.keys();
    const legacyClientPresent = LEGACY_CACHES_TO_AUTO_UPGRADE.some(key => keysBeforeCleanup.includes(key));
    await Promise.all(keysBeforeCleanup.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    // Refresh legacy clients once. Future updates use the Update now banner.
    if (legacyClientPresent) {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(windows.map(client => client.navigate(client.url)));
    }
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
