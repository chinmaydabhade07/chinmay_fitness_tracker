// FitTrack offline support. Keep this file next to index.html.
// The app page is fetched from the network first, so updates show up as soon as you're online;
// the last copy is used when offline. Libraries (React) and other static files are served from cache.
// Nutrition lookups (Open Food Facts, USDA and others) are never cached.
const CACHE = "fittrack-shell-v3";
const SHELL = ["./", "./index.html"];
const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // one failed download shouldn't stop the rest from being stored
    await Promise.allSettled([
      ...SHELL.map(u => c.add(u)),
      ...LIBS.map(u => fetch(u, { mode: "cors" }).then(r => r.ok && c.put(u, r)))
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // The app page: network first, cached copy when offline.
  if (req.mode === "navigate" || (sameOrigin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        // skip the browser's HTTP cache so a freshly uploaded index.html shows up right away
        const res = await fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
        if (res.ok) c.put("./index.html", res.clone());
        return res;
      } catch (err) {
        return (await c.match("./index.html")) || (await c.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Libraries and the app's own static files: cache first.
  if (url.hostname === "cdnjs.cloudflare.com" || (sameOrigin && !url.pathname.endsWith("sw.js"))) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
  }
  // Everything else (nutrition APIs) goes straight to the network.
});
