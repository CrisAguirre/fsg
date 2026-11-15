import { useCallback, useEffect, useState } from "react";
import { readConnectionInfo } from "../lib/connection.js";
import {
  readLightweightPreference,
  subscribeLightweight,
  writeLightweightPreference,
} from "../lib/lightweightPreference.js";

/**
 * Calidad de red reactiva. Marca `data-connection="light"` en <html> para que
 * el CSS apague animaciones y desenfoques pesados en conexiones lentas.
 * `preference` (null/true/false) permite forzar el modo cuando el navegador no
 * expone Network Information API; `setLightweight` lo cambia y persiste.
 */
export function useConnectionQuality() {
  const [info, setInfo] = useState(() =>
    readConnectionInfo(undefined, readLightweightPreference()),
  );

  const update = useCallback(() => {
    setInfo(readConnectionInfo(undefined, readLightweightPreference()));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const nav = /** @type {any} */ (navigator);
    const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

    connection?.addEventListener?.("change", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const unsubscribe = subscribeLightweight(update);

    return () => {
      connection?.removeEventListener?.("change", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      unsubscribe();
    };
  }, [update]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.connection = info.lightweight ? "light" : "full";
  }, [info.lightweight]);

  const setLightweight = useCallback((value) => {
    writeLightweightPreference(value);
  }, []);

  return {
    ...info,
    preference: readLightweightPreference(),
    setLightweight,
  };
}
