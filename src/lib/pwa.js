// Registro del service worker. Solo en producción: en dev Vite sirve módulos sin
// hash y el SW estorbaría al HMR. Cuando hay una versión nueva, el SW queda en
// espera (no hace skipWaiting) y `UpdatePrompt` pide confirmación antes de
// activarla y recargar, para no mezclar assets viejos y nuevos.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

const updateListeners = new Set();
let waitingWorker = null;
let reloadOnControllerChange = false;

/** @returns {boolean} true si hay una versión nueva esperando activación */
export function isPwaUpdateReady() {
  return Boolean(waitingWorker);
}

/**
 * Suscribe a la detección de una versión nueva. El componente debe leer
 * `isPwaUpdateReady()` al montar por si el SW ya estaba esperando.
 * @param {() => void} listener
 */
export function onPwaUpdate(listener) {
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

/**
 * Activa la versión en espera. El `controllerchange` posterior recarga la app.
 * @returns {boolean} false si no había una versión esperando
 */
export function applyPwaUpdate() {
  if (!waitingWorker) return false;
  reloadOnControllerChange = true;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
  return true;
}

function notifyUpdate(worker) {
  if (!worker || worker === waitingWorker) return;
  waitingWorker = worker;
  for (const listener of updateListeners) listener();
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadOnControllerChange || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const checkWaiting = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            notifyUpdate(registration.waiting);
          }
        };
        checkWaiting();

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") checkWaiting();
          });
        });

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
