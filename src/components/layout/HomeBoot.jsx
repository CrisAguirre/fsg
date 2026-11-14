import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/useTheme";
import { useConnectionQuality } from "../../hooks/useConnectionQuality.js";
import { wakeBackend } from "../../lib/api.js";
import AppPreloader from "../ui/AppPreloader.jsx";

const MIN_OVERLAY_MS = 750;
const MAX_OVERLAY_MS = 2800;
const READY_VISIBLE_MS = 1800;
const BOOT_KEY = "gpv.home.booted";

function wasBooted() {
  try {
    return sessionStorage.getItem(BOOT_KEY) === "1";
  } catch {
    return false;
  }
}

function markBooted() {
  try {
    sessionStorage.setItem(BOOT_KEY, "1");
  } catch {
    /* sessionStorage puede fallar en modo privado */
  }
}

/**
 * Despierta Render al entrar al home y muestra un preloader con el logo. El
 * overlay se puede saltar; si el servidor tarda, queda un aviso no bloqueante.
 */
export default function HomeBoot() {
  const { logo } = useTheme();
  const { lightweight, label: connectionLabel } = useConnectionQuality();
  const [status, setStatus] = useState("waking");
  const [overlay, setOverlay] = useState(() => !wasBooted());
  const [readyVisible, setReadyVisible] = useState(true);
  const startedAtRef = useRef(0);

  const closeOverlay = useCallback(() => {
    setOverlay(false);
    markBooted();
  }, []);

  // Al montar solo se lanza la petición; el estado inicial ya es "waking".
  // La promesa se comparte con StrictMode y con cualquier otro montaje.
  useEffect(() => {
    startedAtRef.current = Date.now();
    wakeBackend()
      .then(() => setStatus("awake"))
      .catch(() => setStatus("error"));
  }, []);

  const retry = useCallback(() => {
    setStatus("waking");
    setReadyVisible(true);
    startedAtRef.current = Date.now();
    wakeBackend({ force: true })
      .then(() => setStatus("awake"))
      .catch(() => setStatus("error"));
  }, []);

  // El overlay no debe bloquear el home si Render sigue arrancando.
  useEffect(() => {
    if (!overlay) return undefined;
    const timer = setTimeout(closeOverlay, MAX_OVERLAY_MS);
    return () => clearTimeout(timer);
  }, [overlay, closeOverlay]);

  // Si el backend responde rápido, se respeta un mínimo para evitar un flash.
  useEffect(() => {
    if (!overlay || status !== "awake") return undefined;
    const remaining = Math.max(0, MIN_OVERLAY_MS - (Date.now() - startedAtRef.current));
    const timer = setTimeout(closeOverlay, remaining);
    return () => clearTimeout(timer);
  }, [overlay, status, closeOverlay]);

  // El aviso "Servidor listo" se oculta solo; no vuelve a encenderse solo.
  useEffect(() => {
    if (overlay || status !== "awake" || !readyVisible) return undefined;
    const timer = setTimeout(() => setReadyVisible(false), READY_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [overlay, status, readyVisible]);

  // En conexiones rápidas se adelanta el chunk del escáner mientras el usuario
  // lee el home. En modo ligero no se descarga nada extra.
  useEffect(() => {
    if (lightweight) return undefined;
    const timer = setTimeout(() => {
      import("../../pages/Scanner.jsx").catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [lightweight]);

  const showPill = !overlay && (status !== "awake" || readyVisible);
  const detail = status === "error"
    ? "El servidor no respondió. Puedes continuar y reintentar."
    : "Despertando el servidor de análisis…";

  return (
    <>
      {overlay ? (
        <AppPreloader
          variant="overlay"
          label="Preparando tu experiencia"
          detail={detail}
          onSkip={closeOverlay}
          skipLabel="Continuar sin esperar"
        />
      ) : null}

      {showPill ? (
        <div className={`home-boot home-boot--${status}`} role="status" aria-live="polite">
          <img src={logo} alt="" className="home-boot__logo" width="32" height="32" />
          <div className="home-boot__text">
            <strong>
              {status === "waking"
                ? "Despertando el servidor"
                : status === "awake"
                  ? "Servidor listo"
                  : "Servidor no disponible"}
            </strong>
            <span>
              {status === "waking"
                ? lightweight
                  ? `${connectionLabel} · priorizando el modo 2D`
                  : "El análisis estará listo en unos segundos."
                : status === "awake"
                  ? "Ya puedes iniciar el escaneo."
                  : "Revisa tu conexión o reintenta."}
            </span>
          </div>
          {lightweight ? <span className="home-boot__badge">Modo ligero</span> : null}
          {status === "error" ? (
            <button type="button" className="home-boot__retry" onClick={retry}>
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
