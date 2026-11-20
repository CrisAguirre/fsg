import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/useTheme";
import { useConnectionQuality } from "../../hooks/useConnectionQuality.js";
import { listFrames, wakeBackend } from "../../lib/api.js";
import AppPreloader from "../ui/AppPreloader.jsx";

// El overlay se muestra en cada carga completa del home (recarga o primera
// visita), pero no al volver al home dentro de la misma SPA: eso sería
// repetitivo. El estado de módulo se reinicia con la página.
let bootShownThisLoad = false;

const MIN_OVERLAY_MS = 900;
const MAX_OVERLAY_MS = 12000;
const READY_VISIBLE_MS = 2200;

/**
 * Despierta Render al entrar al home y muestra un preloader con el logo.
 * Además del `/health` compartido, adelanta el catálogo de monturas para que
 * el escáner no arranque vacío. El overlay se puede saltar y nunca bloquea el
 * home más de `MAX_OVERLAY_MS`.
 */
export default function HomeBoot() {
  const { logo } = useTheme();
  const { lightweight, label: connectionLabel } = useConnectionQuality();
  const [status, setStatus] = useState("waking");
  const [catalogReady, setCatalogReady] = useState(false);
  const [overlay, setOverlay] = useState(() => !bootShownThisLoad);
  const [readyVisible, setReadyVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef(0);

  const closeOverlay = useCallback(() => {
    bootShownThisLoad = true;
    setOverlay(false);
  }, []);

  const preloadCatalog = useCallback(() => {
    listFrames()
      .catch(() => null)
      .finally(() => setCatalogReady(true));
  }, []);

  // Al montar solo se lanzan las peticiones; el estado inicial ya es "waking".
  // La promesa de `wakeBackend` se comparte con StrictMode y con el escáner.
  useEffect(() => {
    startedAtRef.current = Date.now();
    let alive = true;
    wakeBackend()
      .then(() => {
        if (!alive) return;
        setStatus("awake");
        preloadCatalog();
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [preloadCatalog]);

  const retry = useCallback(() => {
    setStatus("waking");
    setCatalogReady(false);
    setReadyVisible(true);
    setElapsed(0);
    startedAtRef.current = Date.now();
    wakeBackend({ force: true })
      .then(() => {
        setStatus("awake");
        preloadCatalog();
      })
      .catch(() => setStatus("error"));
  }, [preloadCatalog]);

  // Contador visible mientras Render arranca: el primer cold start puede tardar.
  useEffect(() => {
    if (!overlay || status !== "waking") return undefined;
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
    }, 500);
    return () => clearInterval(timer);
  }, [overlay, status]);

  // El overlay no debe bloquear el home si Render sigue arrancando.
  useEffect(() => {
    if (!overlay) return undefined;
    const timer = setTimeout(closeOverlay, MAX_OVERLAY_MS);
    return () => clearTimeout(timer);
  }, [overlay, closeOverlay]);

  // Si el backend responde rápido, se respeta un mínimo para evitar un flash.
  // También se espera a que el catálogo esté listo (o haya fallado) para que el
  // escáner no abra con la lista vacía.
  useEffect(() => {
    if (!overlay) return undefined;
    if (status === "error") {
      const timer = setTimeout(closeOverlay, 1600);
      return () => clearTimeout(timer);
    }
    if (status !== "awake" || !catalogReady) return undefined;
    const remaining = Math.max(0, MIN_OVERLAY_MS - (Date.now() - startedAtRef.current));
    const timer = setTimeout(closeOverlay, remaining);
    return () => clearTimeout(timer);
  }, [overlay, status, catalogReady, closeOverlay]);

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
    ? "El servidor no respondió. Puedes continuar y reintentar desde el aviso."
    : status === "awake"
      ? catalogReady
        ? "Servidor listo. Catálogo de monturas preparado."
        : "Servidor listo. Preparando el catálogo de monturas…"
      : elapsed > 0
        ? `Despertando el servidor de análisis… ${elapsed}s`
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
