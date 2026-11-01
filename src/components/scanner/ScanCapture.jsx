// Entrada del escaneo: cámara en vivo o foto subida. Se reutiliza en el primer
// escaneo (sin monturas) y en el escaneo con montura.
export default function ScanCapture({
  tab,
  onTab,
  videoRef,
  overlayRef,
  threeLiveRef,
  livePts = 0,
  arOk = null,
  onStartCamera,
  onCapture,
  onUpload,
  hint,
  children = null,
}) {
  return (
    <>
      <div className="scanner__tabs glass">
        <button
          type="button"
          className={tab === "camara" ? "active" : ""}
          onClick={() => onTab("camara")}
          aria-pressed={tab === "camara"}
        >
          📷 Cámara en vivo
        </button>
        <button
          type="button"
          className={tab === "subir" ? "active" : ""}
          onClick={() => onTab("subir")}
          aria-pressed={tab === "subir"}
        >
          🖼️ Subir foto
        </button>
      </div>

      {tab === "camara" ? (
        <div className="glass scanner__panel">
          <div className="scanner__camwrap">
            <video ref={videoRef} playsInline muted className="scanner__video" />
            <canvas ref={overlayRef} className="scanner__overlay" aria-hidden="true" />
            <canvas ref={threeLiveRef} className="scanner__overlay scanner__overlay--3d" aria-hidden="true" />
          </div>
          <div
            className={`scanner__live ${livePts > 0 ? "scanner__live--ok" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span className="scanner__live-dot" aria-hidden="true" />
            {livePts > 0
              ? `Escaneo en vivo · ${livePts} puntos faciales detectados`
              : "Escaneo en vivo · buscando tu rostro"}
          </div>
          <small>{hint}</small>
          <div className="scanner__row">
            <button type="button" className="btn btn--glass" onClick={onStartCamera}>
              Activar cámara
            </button>
            <button type="button" className="btn btn--primary" onClick={onCapture}>
              Capturar rostro
            </button>
            {arOk === false && <span className="tag">Probador 2D</span>}
          </div>
          <small>Requiere HTTPS y permiso de cámara. En iPhone usa Safari y el botón Capturar.</small>
          {children}
        </div>
      ) : (
        <div className="glass scanner__panel">
          <label className="scanner__dropzone">
            <span className="scanner__dropzone-icon" aria-hidden="true">📁</span>
            <b>Haz clic o arrastra una foto de tu rostro</b>
            <small>JPG, PNG o WebP de tu dispositivo. De frente, con buena luz.</small>
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
        </div>
      )}
    </>
  );
}
