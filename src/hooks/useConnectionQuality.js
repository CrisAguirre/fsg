import { useEffect, useState } from "react";
import { readConnectionInfo } from "../lib/connection.js";

/**
 * Calidad de red reactiva. Marca `data-connection="light"` en <html> para que
 * el CSS apague animaciones y desenfoques pesados en conexiones lentas.
 */
export function useConnectionQuality() {
  const [info, setInfo] = useState(() => readConnectionInfo());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const update = () => setInfo(readConnectionInfo());
    const nav = /** @type {any} */ (navigator);
    const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

    connection?.addEventListener?.("change", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();

    return () => {
      connection?.removeEventListener?.("change", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.connection = info.lightweight ? "light" : "full";
  }, [info.lightweight]);

  return info;
}
