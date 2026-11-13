// Service worker del PWA de Grupo Prisma Visión.
// Estrategia:
//   - Navegación: red primero y respaldo al index.html cacheado (shell offline).
//   - /assets/* (nombres con hash): caché primero, son inmutables.
//   - Imágenes, GLB y manifest: caché primero + actualización en segundo plano.
//   - API y CDN (otro origen): no se interceptan; la app ya maneja timeouts,
//     reintentos y caché de catálogo en localStorage.
// Suba VERSION cuando quiera invalidar todas las cachés del cliente.
const VERSION = "v2";
const SHELL_CACHE = `gpv-shell-${VERSION}`;
const RUNTIME_CACHE = `gpv-runtime-${VERSION}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, RUNTIME_CACHE]);

const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !CURRENT_CACHES.has(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return fetchAndCache(request);
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put("/index.html", response.clone());
      return response;
    }
  } catch {
    // Sin red: se sirve el shell cacheado.
  }
  return (await cache.match("/index.html")) || (await cache.match("/")) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // El resto (imágenes, try-on, GLB, manifest): responde rápido desde caché y
  // refresca en segundo plano. waitUntil se registra de forma síncrona.
  const networkPromise = fetchAndCache(request);
  event.waitUntil(networkPromise.catch(() => {}));
  event.respondWith(caches.match(request).then((cached) => cached || networkPromise));
});
