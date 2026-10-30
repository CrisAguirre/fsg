// MediaPipe Tasks-Vision envía telemetría a https://odml.pa.googleapis.com/v1/log
// cada vez que crea o cierra una tarea. En este producto el endpoint responde
// 403 (clave restringida) y ensucia la consola/Network sin aportar nada, además
// de ser tráfico de un tercero en una app que procesa datos biométricos.
//
// Se intercepta `fetch` y se responde 200 vacío a esa ruta: el navegador nunca
// abre la conexión y MediaPipe no reintenta. Cualquier otra URL pasa intacta.
const BLOCKED_HOSTS = new Set(["odml.pa.googleapis.com"]);

let installed = false;

/** Instala el bloqueo una sola vez. Idempotente y no-op fuera del navegador. */
export function blockMediapipeTelemetry() {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    try {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input?.url;
      if (raw) {
        const { hostname } = new URL(raw, window.location.href);
        if (BLOCKED_HOSTS.has(hostname)) {
          return Promise.resolve(new Response("", { status: 200 }));
        }
      }
    } catch {
      /* URL no parseable: se deja pasar al fetch real */
    }
    return originalFetch(input, init);
  };
}

/** Solo para tests: vuelve a permitir instalar el bloqueo. */
export function __resetMediapipeTelemetry() {
  installed = false;
}
