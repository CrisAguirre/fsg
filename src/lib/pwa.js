// Registro del service worker. Solo en producción: en dev Vite sirve módulos sin
// hash y el SW estorbaría al HMR. Si hay una versión nueva y la pestaña ya tenía
// un SW controlando, se recarga una sola vez para no mezclar assets viejos/nuevos.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        let lastCheck = Date.now();
        const checkForUpdate = () => {
          if (document.visibilityState !== "visible") return;
          if (Date.now() - lastCheck < UPDATE_INTERVAL_MS) return;
          lastCheck = Date.now();
          registration.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", checkForUpdate);
      })
      .catch(() => {
        // Sin SW la app sigue funcionando; no bloquea el arranque.
      });
  });
}
