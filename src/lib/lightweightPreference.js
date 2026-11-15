// Preferencia manual de "modo ligero". Vive fuera de React para que el toggle
// del navbar y los hooks de cámara/foto compartan el mismo estado en la pestaña.
// Si localStorage falla (modo privado), se conserva en memoria durante la sesión.
const STORAGE_KEY = "gpv.lightweight";
const listeners = new Set();

let cached = null;
let loaded = false;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // Storage bloqueado: se usa la detección automática.
  }
  return null;
}

/** @returns {boolean|null} true/false si el usuario lo forzó; null = automático */
export function readLightweightPreference() {
  if (!loaded) {
    cached = load();
    loaded = true;
  }
  return cached;
}

/** @param {boolean|null} value */
export function writeLightweightPreference(value) {
  cached = value === true ? true : value === false ? false : null;
  loaded = true;
  try {
    if (cached === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, cached ? "1" : "0");
  } catch {
    // Sin persistencia: el cambio sigue aplicando en memoria vía listeners.
  }
  for (const listener of listeners) listener();
}

/** @param {() => void} listener */
export function subscribeLightweight(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
