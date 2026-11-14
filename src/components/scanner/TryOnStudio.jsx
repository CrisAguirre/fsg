// Probador virtual independiente (4.ª card): cámara en vivo con armazón 3D o
// foto subida/capturada con modelo 2D/3D seleccionable. No depende del análisis
// facial ni de las recomendaciones; solo del catálogo de monturas.
import { useEffect, useState } from "react";
import { normalizeImageFile } from "../../lib/imageUtils.js";
import { useLiveCameraTryOn } from "../../hooks/useLiveCameraTryOn.js";
import { usePhotoTryOn } from "../../hooks/usePhotoTryOn.js";
import LensControls from "./LensControls.jsx";
import TryOnDetail from "./TryOnDetail.jsx";

function ConsentGate({ onConsent, onClose }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <section className="glass scanner__panel tryon__consent">
      <h2>Consentimiento para el probador virtual</h2>
      <label className="scanner__consent">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        Acepto el procesamiento de mi imagen para el probador virtual (dato
        sensible, Ley 1581/2012). La foto se procesa en mi dispositivo y no se
        envía ni se almacena en el servidor.
      </label>
      <div className="scanner__row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!accepted}
          onClick={() => onConsent(true)}
        >
          Continuar
        </button>
        <button type="button" className="btn btn--glass" onClick={onClose}>
          Volver
        </button>
      </div>
    </section>
  );
}

function ModeToggle({ use3D, onChange }) {
  return (
    <div className="tryon__mode" role="group" aria-label="Modelo de montura">
      <button type="button" aria-pressed={use3D} onClick={() => onChange(true)}>
        3D real
      </button>
      <button type="button" aria-pressed={!use3D} onClick={() => onChange(false)}>
        2D
      </button>
    </div>
  );
}

function FramePicker({ frames, tryId, onSelect }) {
  return (
    <div className="tryon__picker">
      <label className="scanner__live-select">
        Montura
        <select
          value={tryId}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="Montura para el probador"
          className="scanner__select"
        >
          {frames.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre} · {f.forma}
            </option>
          ))}
        </select>
      </label>
      <div className="tryon__strip" role="group" aria-label="Monturas del catálogo">
        {frames.map((f) => {
          const active = f.id === tryId;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              title={`${f.nombre} · ${f.forma}`}
              className={`tryon__strip-btn ${active ? "tryon__strip-btn--active" : ""}`}
              onClick={() => onSelect(f.id)}
            >
              <img
                src={f.imagen_url || `/frames/${f.forma || "rectangular"}.jpg`}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
              <span>{f.nombre}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   frames: import("../../types").TryFrame[],
 *   tryRef: { current: import("../../types").TryState },
 *   tryId: string,
 *   onTryId: (id: string) => void,
 *   tryOpacity: number,
 *   onOpacity: (v: number) => void,
 *   tryLens: string,
 *   onLens: (v: string) => void,
 *   lensStyle: import("../../types").LensStyle,
 *   onLensStyle: (v: import("../../types").LensStyle) => void,
 *   use3D: boolean,
 *   onUse3D: (v: boolean) => void,
 *   lightweight?: boolean,
 *   showOriginal: boolean,
 *   onShowOriginal: (v: boolean) => void,
 *   tryOn: boolean,
 *   onTryOn: (v: boolean) => void,
 *   metrics: import("../../types").TryMetrics | null,
 *   consent: boolean,
 *   onConsent: (v: boolean) => void,
 *   onClose: () => void,
 *   onReload: () => Promise<import("../../types").TryFrame[]>,
 * }} props
 */
export default function TryOnStudio({
  frames,
  tryRef,
  tryId,
  onTryId,
  tryOpacity,
  onOpacity,
  tryLens,
  onLens,
  lensStyle,
  onLensStyle,
  use3D,
  onUse3D,
  lightweight = false,
  showOriginal,
  onShowOriginal,
  tryOn,
  onTryOn,
  metrics,
  consent,
  onConsent,
  onClose,
  onReload,
}) {
  const [tab, setTab] = useState("camara"); // camara | foto
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [reloading, setReloading] = useState(false);

  const {
    videoRef,
    overlayRef,
    threeLiveRef,
    livePts,
    arOk,
    setArOk,
    startCamera,
    stopCamera,
  } = useLiveCameraTryOn({ tryRef, onError: setError, lightweight });

  const {
    photoCanvasRef,
    photoImgRef,
    threePhotoRef,
    fitInfo,
    photoWarn,
    downloadHD,
    resetPhotoTryOn,
  } = usePhotoTryOn({
    preview,
    tryRef,
    tryId,
    tryOn,
    metrics,
    tryOpacity,
    tryLens,
    lensStyle,
    showOriginal,
    frames,
    setArOk,
    use3D,
    lightweight,
  });

  // La URL de la foto es local: se libera al cambiarla o al cerrar el probador.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const tryFrame = frames.find((x) => x.id === tryId) ?? frames[0] ?? null;

  function openPhoto(url) {
    resetPhotoTryOn();
    setPreview(url);
    setZoomed(false);
    setTab("foto");
    setError("");
  }

  async function handleStartCamera() {
    setError("");
    await startCamera();
    setCameraOn(!!videoRef.current?.srcObject);
  }

  function handleStopCamera() {
    stopCamera();
    setCameraOn(false);
  }

  function captureLive() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setError("La cámara aún no está lista. Espera un segundo e intenta de nuevo.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (!b) {
          setError("No se pudo capturar la imagen. Intenta de nuevo.");
          return;
        }
        openPhoto(URL.createObjectURL(b));
        handleStopCamera();
      },
      "image/jpeg",
      lightweight ? 0.78 : 0.92,
    );
  }

  async function handleUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setLoading("Preparando tu foto…");
    try {
      const normalized = await normalizeImageFile(
        f,
        lightweight ? { maxDim: 960, quality: 0.78 } : undefined,
      );
      openPhoto(normalized.previewUrl);
    } catch {
      openPhoto(URL.createObjectURL(f));
    } finally {
      setLoading("");
      if (e.target) e.target.value = "";
    }
  }

  async function handleReload() {
    setReloading(true);
    setError("");
    try {
      await onReload();
    } finally {
      setReloading(false);
    }
  }

  function downloadEvidence() {
    try {
      const f = tryFrame;
      const ev = {
        fecha: new Date().toISOString(),
        servicio: "probador_virtual",
        analisis_facial: false,
        modelo: f
          ? {
              id: f.id,
              nombre: f.nombre,
              forma: f.forma,
              material: f.material,
              color: f.color,
              A_mm: f.A_mm,
              B_mm: f.B_mm,
              D_mm: f.D_mm,
              ancho_total_mm: f.ancho_total_mm,
            }
          : null,
        lente_montado: tryLens,
        opacidad: tryOpacity,
        modo3D: fitInfo?.mode3D === true,
        montaje: fitInfo,
        nota: "Probador virtual independiente: la imagen se procesó en el dispositivo y no se envió al servidor.",
      };
      const blob = new Blob([JSON.stringify(ev, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `probador-${f?.id ?? "montura"}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      /* descarga no disponible */
    }
  }

  return (
    <section className="tryon" aria-label="Probador virtual de monturas">
      <div className="glass tryon__head">
        <div>
          <span className="tryon__eyebrow">Servicio alterno · opcional</span>
          <h2>Probador virtual de monturas</h2>
          <p>
            Pruébate el catálogo con la cámara en vivo o sobre una foto. Elige 2D o 3D.
            No requiere el escaneo facial.
          </p>
          {lightweight ? (
            <p>
              <span className="tag tag--highlight">Modo ligero</span>{" "}
              Se prioriza el 2D y se reducen las fotos para ahorrar datos. Puedes activar 3D manualmente.
            </p>
          ) : null}
        </div>
        <button type="button" className="btn btn--glass btn--sm" onClick={onClose}>
          ← Volver
        </button>
      </div>

      {!consent ? (
        <ConsentGate onConsent={onConsent} onClose={onClose} />
      ) : frames.length === 0 ? (
        <div className="glass scanner__panel">
          <div className="tryon__placeholder">
            <span className="tryon__placeholder-icon" aria-hidden="true">📦</span>
            <b>Catálogo de monturas no disponible</b>
            <small>
              El probador necesita el catálogo para mostrar los modelos. Revisa tu
              conexión y vuelve a intentar.
            </small>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleReload}
              disabled={reloading}
            >
              {reloading ? "Cargando…" : "Reintentar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="scanner__tabs glass">
            <button
              type="button"
              className={tab === "camara" ? "active" : ""}
              aria-pressed={tab === "camara"}
              onClick={() => setTab("camara")}
            >
              📷 Cámara en vivo
            </button>
            <button
              type="button"
              className={tab === "foto" ? "active" : ""}
              aria-pressed={tab === "foto"}
              onClick={() => {
                setTab("foto");
                handleStopCamera();
              }}
            >
              🖼️ Foto o captura
            </button>
          </div>

          {tab === "camara" ? (
            <div className="glass scanner__panel">
              <div className="scanner__camwrap">
                <video ref={videoRef} playsInline muted className="scanner__video" />
                <canvas ref={overlayRef} className="scanner__overlay" aria-hidden="true" />
                <canvas
                  ref={threeLiveRef}
                  className="scanner__overlay scanner__overlay--3d"
                  aria-hidden="true"
                />
                {!cameraOn && (
                  <div className="tryon__camoff">
                    <span className="tryon__placeholder-icon" aria-hidden="true">🎥</span>
                    <b>Enciende la cámara para probarte las monturas en vivo</b>
                    <small>
                      El armazón 3D sigue tu rostro en tiempo real. También puedes subir
                      una foto o capturarla.
                    </small>
                  </div>
                )}
                {cameraOn && (
                  <LensControls lensStyle={lensStyle} tint={tryLens} onChange={onLensStyle} />
                )}
              </div>

              <div
                className={`scanner__live ${livePts > 0 ? "scanner__live--ok" : ""}`}
                role="status"
                aria-live="polite"
              >
                <span className="scanner__live-dot" aria-hidden="true" />
                {!cameraOn
                  ? "Cámara apagada"
                  : livePts > 0
                    ? `Cámara en vivo · ${livePts} puntos faciales detectados`
                    : "Cámara en vivo · buscando tu rostro"}
              </div>

              <div className="scanner__row">
                <button type="button" className="btn btn--primary" onClick={handleStartCamera}>
                  🎥 {cameraOn ? "Reiniciar cámara" : "Activar cámara"}
                </button>
                {cameraOn && (
                  <button type="button" className="btn btn--glass" onClick={handleStopCamera}>
                    ⏹ Detener
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--glass"
                  onClick={captureLive}
                  disabled={!cameraOn}
                >
                  📸 Capturar y probar en foto
                </button>
              </div>
              <small>
                Requiere HTTPS y permiso de cámara. En iPhone usa Safari. La imagen no se
                envía al servidor.
              </small>

              <FramePicker frames={frames} tryId={tryId} onSelect={onTryId} />

              <div className="scanner__row">
                <ModeToggle use3D={use3D} onChange={onUse3D} />
                <label className="scanner__opacity" title="Transparencia de la montura">
                  Montura
                  <input
                    type="range"
                    min="0.35"
                    max="1"
                    step="0.05"
                    value={tryOpacity}
                    onChange={(e) => onOpacity(Number(e.target.value))}
                    aria-label="Opacidad de la montura"
                  />
                  {Math.round(tryOpacity * 100)}%
                </label>
                <label className="scanner__opacity">
                  <input
                    type="checkbox"
                    checked={tryOn}
                    onChange={(e) => onTryOn(e.target.checked)}
                  />
                  Mostrar montura
                </label>
              </div>

              <TryOnDetail
                frame={tryFrame}
                recs={[]}
                tryId={tryId}
                metrics={metrics}
                tryLens={tryLens}
                onSelectLens={onLens}
                standalone
              />

              {arOk === false && (
                <p className="scanner__warning">
                  ⚠ El 3D no está disponible en este dispositivo; se muestra el modo 2D.
                </p>
              )}
            </div>
          ) : (
            <div className="glass scanner__panel">
              {!preview ? (
                <>
                  <label className="scanner__dropzone">
                    <span className="scanner__dropzone-icon" aria-hidden="true">📁</span>
                    <b>Sube una foto de tu rostro</b>
                    <small>
                      JPG, PNG o WebP. De frente, con buena luz. La foto se procesa en tu
                      dispositivo y no se envía al servidor.
                    </small>
                    <input type="file" accept="image/*" onChange={handleUpload} />
                  </label>
                  <div className="scanner__row">
                    <button
                      type="button"
                      className="btn btn--glass"
                      onClick={() => setTab("camara")}
                    >
                      🎥 Usar la cámara
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img
                    ref={photoImgRef}
                    src={preview}
                    alt="rostro para el probador"
                    className="scanner__preview"
                    style={{ display: "none" }}
                  />
                  <div className="scanner__montage">
                    <div className={`scanner__zoomwrap ${zoomed ? "zoomed" : ""}`}>
                      <canvas
                        ref={photoCanvasRef}
                        className="scanner__preview"
                        onClick={() => setZoomed((z) => !z)}
                        title={zoomed ? "Clic para alejar" : "Clic para ampliar detalle"}
                      />
                      <canvas
                        ref={threePhotoRef}
                        className="scanner__overlay scanner__overlay--3d"
                        aria-hidden="true"
                      />
                    </div>
                    <LensControls lensStyle={lensStyle} tint={tryLens} onChange={onLensStyle} />
                  </div>
                  {photoWarn && <p className="scanner__warning">⚠ {photoWarn}</p>}

                  <div className="scanner__row">
                    <button
                      type="button"
                      className="btn btn--glass btn--sm"
                      onClick={() => {
                        resetPhotoTryOn();
                        setPreview(null);
                      }}
                    >
                      🔄 Cambiar foto
                    </button>
                    <button
                      type="button"
                      className="btn btn--glass btn--sm"
                      onClick={() => setTab("camara")}
                    >
                      🎥 Usar la cámara
                    </button>
                  </div>

                  <FramePicker frames={frames} tryId={tryId} onSelect={onTryId} />

                  <div className="scanner__row">
                    <ModeToggle use3D={use3D} onChange={onUse3D} />
                    <label className="scanner__opacity" title="Transparencia de la montura">
                      Montura
                      <input
                        type="range"
                        min="0.35"
                        max="1"
                        step="0.05"
                        value={tryOpacity}
                        onChange={(e) => onOpacity(Number(e.target.value))}
                        aria-label="Opacidad de la montura"
                      />
                      {Math.round(tryOpacity * 100)}%
                    </label>
                    <button
                      type="button"
                      className="btn btn--glass"
                      onPointerDown={() => onShowOriginal(true)}
                      onPointerUp={() => onShowOriginal(false)}
                      onPointerLeave={() => onShowOriginal(false)}
                      title="Mantén presionado para ver tu foto sin montura"
                    >
                      ◐ Comparar original
                    </button>
                    <button
                      type="button"
                      className="btn btn--glass"
                      onClick={() => setZoomed((z) => !z)}
                      title="Alternar zoom detalle"
                    >
                      {zoomed ? "🔍 Alejar" : "🔍 Detalle"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--glass"
                      onClick={downloadHD}
                      disabled={!fitInfo}
                      title="Descarga en resolución original"
                    >
                      ⬇ Guardar HD
                    </button>
                    <button
                      type="button"
                      className="btn btn--glass"
                      onClick={downloadEvidence}
                      disabled={!fitInfo}
                      title="Descarga un JSON con la montura y el montaje"
                    >
                      🧾 Evidencia
                    </button>
                  </div>

                  <TryOnDetail
                    frame={tryFrame}
                    recs={[]}
                    tryId={tryId}
                    metrics={metrics}
                    tryLens={tryLens}
                    onSelectLens={onLens}
                    standalone
                  />

                  {fitInfo && (
                    <small className="scanner__sub">
                      Montaje {fitInfo.mode3D ? (fitInfo.modeGlb ? "3D GLB" : "3D") : "2D"}:
                      IPD {fitInfo.ipdPx}px · ángulo {fitInfo.angDeg}°
                      {fitInfo.lensW ? ` · lente ${fitInfo.lensW}×${fitInfo.lensH}px` : ""}
                      {` · escala marco ${fitInfo.fitScale}×`}
                      {fitInfo.yaw != null ? ` · giro ${fitInfo.yaw}°` : ""}
                    </small>
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="scanner__error" role="alert">{error}</p>}
          {loading && <p className="scanner__loading" role="status">{loading}</p>}

          <small className="tryon__note">
            Servicio alterno: este probador no analiza tu rostro ni genera
            recomendaciones. Para el informe y la compatibilidad, usa el escaneo facial.
          </small>
        </>
      )}
    </section>
  );
}
