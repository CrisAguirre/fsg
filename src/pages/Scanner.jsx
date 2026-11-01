// Orquestador del escaneo facial en tres pasos:
//   1. Iniciar escaneo → consentimiento → captura (sin monturas) → análisis
//   2. Cards: informe del rostro | monturas recomendadas (probador 3D)
//   3. Escaneo obligatorio con la montura puesta → informe de ajuste
// La lógica pesada vive en hooks (cámara, MediaPipe, 3D) y en `lib/` (porcentajes,
// compatibilidad). Aquí solo se compone el flujo.
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/layout/Navbar.jsx";
import Footer from "../components/layout/Footer.jsx";
import { analyzePhoto, recommend, listFrames, API_URL } from "../lib/api.js";
import { normalizeImageFile } from "../lib/imageUtils.js";
import { lensCompatibility } from "../lib/lensCompatibility.js";
import FeedbackBox from "../components/scanner/FeedbackBox.jsx";
import ScannerMetrics from "../components/scanner/ScannerMetrics.jsx";
import TryOnDetail from "../components/scanner/TryOnDetail.jsx";
import RecommendationCard from "../components/scanner/RecommendationCard.jsx";
import FrameStrip from "../components/scanner/FrameStrip.jsx";
import ScanCapture from "../components/scanner/ScanCapture.jsx";
import ScanReport from "../components/scanner/ScanReport.jsx";
import StepCards from "../components/scanner/StepCards.jsx";
import { useLiveCameraTryOn } from "../hooks/useLiveCameraTryOn.js";
import { usePhotoTryOn } from "../hooks/usePhotoTryOn.js";
import "./Scanner.css";

const RECS_PREVIEW = 12;

const sourceLabel = (tab) => (tab === "camara" ? "Cámara en vivo" : "Foto subida");

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const initialFrame = searchParams.get("frameId");

  // Fase del asistente.
  const [phase, setPhase] = useState("start"); // start|consent|capture|hub|report|catalog|captureFit|fitReport
  const [consent, setConsent] = useState(false);
  const [tab, setTab] = useState("camara"); // camara | subir

  // Escaneo 1 (diagnóstico, sin monturas).
  const [preview, setPreview] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [detectedShape, setDetectedShape] = useState("");
  const [scanMeta, setScanMeta] = useState(null);
  const [recs, setRecs] = useState([]);

  // Escaneo 2 (con la montura física puesta).
  const [fitPreview, setFitPreview] = useState(null);
  const [fitMetrics, setFitMetrics] = useState(null);
  const [fitMeta, setFitMeta] = useState(null);
  const [fitRecs, setFitRecs] = useState([]);
  const [fitFrameId, setFitFrameId] = useState("");
  const [fitRec, setFitRec] = useState(null);

  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [backendOk, setBackendOk] = useState(null);

  // Probador 3D (solo en el paso de monturas).
  const [tryOpacity, setTryOpacity] = useState(0.95);
  const [tryLens, setTryLens] = useState("monofocal");
  const [use3D, setUse3D] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [tryOn, setTryOn] = useState(true);
  const [showAllRecs, setShowAllRecs] = useState(false);
  const [tryId, setTryId] = useState(initialFrame || "F01");
  const [liveOn, setLiveOn] = useState(false);

  const [prevInitialFrame, setPrevInitialFrame] = useState(initialFrame);
  if (initialFrame !== prevInitialFrame) {
    setPrevInitialFrame(initialFrame);
    if (initialFrame) setTryId(initialFrame);
  }

  const tryFrame = frames.find((x) => x.id === tryId) ?? frames[0];
  const fitFrame = frames.find((x) => x.id === fitFrameId) ?? null;
  const tryLensRef = useRef(tryLens);
  useEffect(() => {
    tryLensRef.current = tryLens;
  }, [tryLens]);

  // Al cambiar de montura se monta su lente ideal (no pelea con la elección manual).
  useEffect(() => {
    if (!tryFrame) return;
    const rec = recs.find((r) => r.frame_id === tryFrame.id) ?? null;
    const lenses = lensCompatibility(tryFrame, rec?.score ?? null);
    if (lenses.length > 0 && lenses[0].tipo !== tryLensRef.current) setTryLens(lenses[0].tipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tryId, frames, recs]);

  /** @type {import("../types").TryState} */
  const initialTryRef = { on: true, forma: "rectangular", frame: null, metrics: null, alpha: 0.95, tint: "monofocal", use3D: true };
  const tryRef = useRef(initialTryRef);
  const tryState = { on: tryOn && !showOriginal, forma: tryFrame?.forma ?? "rectangular", frame: tryFrame ?? null, metrics, alpha: tryOpacity, tint: tryLens, use3D };
  useEffect(() => {
    tryRef.current = tryState;
  });

  const {
    videoRef,
    overlayRef,
    threeLiveRef,
    livePts,
    arOk,
    setArOk,
    startCamera,
    stopCamera,
  } = useLiveCameraTryOn({ tryRef, onError: setError });

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
    showOriginal,
    frames,
    setArOk,
  });

  useEffect(() => {
    fetch(`${API_URL}/health`).then(() => setBackendOk(true)).catch(() => setBackendOk(false));
    listFrames()
      .then(setFrames)
      .catch(() => {
        setBackendOk(false);
        setError(
          `No se pudo cargar el catálogo de monturas desde ${API_URL}. Revisa tu conexión o que el servidor de análisis esté activo.`,
        );
      });
  }, []);

  // Liberar object URLs.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { if (fitPreview) URL.revokeObjectURL(fitPreview); }, [fitPreview]);

  function go(next) {
    if (["start", "consent", "hub", "report", "fitReport"].includes(next)) stopCamera();
    if (next === "report" || next === "fitReport") setLiveOn(false);
    setError("");
    setPhase(next);
  }

  /** El catálogo pudo fallar al cargar (CORS, arranque de Render): reintentar. */
  async function ensureCatalog() {
    if (frames.length > 0) return frames;
    try {
      const list = await listFrames();
      setFrames(list);
      return list;
    } catch {
      return frames;
    }
  }

  function capture(mode) {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setError("Cámara aún no lista. Espera 1 s e intenta de nuevo.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (!b) {
          setError("No se pudo capturar. Intenta de nuevo.");
          return;
        }
        const captured = new File([b], `captura-${mode}.jpg`, { type: "image/jpeg" });
        if (mode === "fit") {
          setFitPreview(URL.createObjectURL(b));
        } else {
          setPreview(URL.createObjectURL(b));
          setMetrics(null);
          setRecs([]);
          setScanMeta(null);
        }
        stopCamera();
        if (consent) runAnalysis(captured, mode);
      },
      "image/jpeg",
      0.88,
    );
  }

  async function onUpload(e, mode) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setLoading("Cargando y optimizando imagen…");
    let chosen = null;
    try {
      const normalized = await normalizeImageFile(f);
      chosen = normalized.file;
      if (mode === "fit") {
        setFitPreview(normalized.previewUrl);
      } else {
        setPreview(normalized.previewUrl);
        setMetrics(null);
        setRecs([]);
        setScanMeta(null);
      }
    } catch {
      chosen = f;
      const url = URL.createObjectURL(f);
      if (mode === "fit") {
        setFitPreview(url);
      } else {
        setPreview(url);
      }
    } finally {
      setLoading("");
      if (e.target) e.target.value = "";
    }
    if (consent && chosen) runAnalysis(chosen, mode);
  }

  function saveLastScan(m, sorted, detected = detectedShape) {
    try {
      const top = sorted?.[0];
      sessionStorage.setItem("gs_last_scan", JSON.stringify({
        face_shape: m.face_shape,
        face_shape_detected: detected || m.face_shape,
        frame_id: top?.frame_id ?? null,
        verdict: top?.verdict ?? null,
        score: top?.score ?? null,
        metrics: {
          temporal_est: m.temporal_est,
          ipd_mm_est: m.ipd_mm_est,
          nose_bridge_mm_est: m.nose_bridge_mm_est,
        },
        at: new Date().toISOString(),
      }));
    } catch { /* sessionStorage puede fallar en modo privado */ }
  }

  async function changeShape(shape) {
    if (!metrics || shape === metrics.face_shape) return;
    const m = { ...metrics, face_shape: shape };
    const prev = metrics;
    setMetrics(m);
    setError("");
    setLoading("Recalculando con la forma corregida…");
    try {
      const r = await recommend(m, null);
      const sorted = r.sort((a, b) => b.score - a.score);
      setRecs(sorted);
      saveLastScan(m, sorted);
    } catch {
      setMetrics(prev);
      setError("No se pudo recalcular con la forma corregida. Revisa la conexión.");
    } finally {
      setLoading("");
    }
  }

  async function runAnalysis(target, mode = "scan") {
    if (!consent) {
      setError("Debes aceptar el tratamiento de datos biométricos (Ley 1581) para continuar.");
      return;
    }
    if (!target) {
      setError(tab === "camara" ? "Captura primero con la cámara." : "Selecciona primero una foto de tu rostro.");
      return;
    }
    setError("");
    setLoading("Analizando proporciones faciales…");
    if (mode === "scan") {
      setMetrics(null);
      setRecs([]);
      setShowAllRecs(false);
    }
    try {
      const m = await analyzePhoto(target);
      if (!m || !m.face_detected) {
        throw new Error(m?.warnings?.[0] || "No se detectó un rostro frontal claro. Asegúrate de mirar de frente y tener buena luz.");
      }
      await ensureCatalog();
      setLoading("Calculando compatibilidades con el stock…");
      const r = await recommend(m, null);
      const sorted = r.sort((a, b) => b.score - a.score);
      if (mode === "fit") {
        setFitMetrics(m);
        setFitRecs(sorted);
        setFitRec(sorted.find((x) => x.frame_id === fitFrameId) ?? null);
        setFitMeta({ at: new Date().toISOString(), source: sourceLabel(tab) });
        setPhase("fitReport");
      } else {
        setMetrics(m);
        setDetectedShape(m.face_shape);
        setScanMeta({ at: new Date().toISOString(), source: sourceLabel(tab) });
        setRecs(sorted);
        saveLastScan(m, sorted, m.face_shape);
        setPhase("hub");
      }
    } catch (e) {
      const netErr = e instanceof TypeError || /failed to fetch|load failed|networkerror|api 5\d\d/i.test(e.message || "");
      const msg = e.name === "AbortError"
        ? "El servidor tardó en responder. Por favor intenta de nuevo."
        : netErr
          ? "No se pudo conectar con el servidor de análisis. Revisa tu conexión y vuelve a intentar."
          : (e.message || "Error al analizar la imagen.");
      setError(msg);
    } finally {
      setLoading("");
    }
  }

  function erasePhoto() {
    if (preview) URL.revokeObjectURL(preview);
    if (fitPreview) URL.revokeObjectURL(fitPreview);
    setPreview(null); setMetrics(null); setRecs([]); setError(""); setZoomed(false); setShowOriginal(false);
    setDetectedShape("");
    setScanMeta(null);
    setFitPreview(null); setFitMetrics(null); setFitMeta(null); setFitRecs([]); setFitRec(null);
    setFitFrameId("");
    resetPhotoTryOn();
    try { sessionStorage.removeItem("gs_last_scan"); } catch { /* noop */ }
    fetch(`${API_URL}/analyze/photo`, { method: "DELETE" }).catch(() => {});
    setPhase("start");
  }

  function downloadEvidence() {
    try {
      const t = tryRef.current;
      const ev = {
        fecha: new Date().toISOString(),
        modelo: t.frame ? { id: t.frame.id, nombre: t.frame.nombre, forma: t.frame.forma, material: t.frame.material, color: t.frame.color, A_mm: t.frame.A_mm, B_mm: t.frame.B_mm, D_mm: t.frame.D_mm, ancho_total_mm: t.frame.ancho_total_mm } : null,
        lente_montado: tryLens,
        opacidad: tryOpacity,
        modo3D: fitInfo?.mode3D === true,
        metricas: metrics ? { face_shape: metrics.face_shape, symmetry_index: metrics.symmetry_index, ipd_mm_est: metrics.ipd_mm_est, temporal_est: metrics.temporal_est, nose_bridge_mm_est: metrics.nose_bridge_mm_est } : null,
        montaje: fitInfo,
        top3: recs.slice(0, 3).map((r) => ({ frame_id: r.frame_id, score: r.score, verdict: r.verdict })),
      };
      const blob = new Blob([JSON.stringify(ev, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `evidencia-${tryId || "montura"}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch { /* noop */ }
  }

  const step = phase === "start" || phase === "consent" || phase === "capture" ? 1 : phase === "hub" || phase === "report" || phase === "catalog" ? 2 : 3;

  return (
    <>
      <Navbar />
      <div className="container scanner">
        <h1>Escáner Facial · <span className="text-gradient">Grupo Prisma Visión</span></h1>
        <p className="scanner__sub">
          Análisis facial · estimaciones orientativas · Backend: <code>{API_URL}</code> · {backendOk === null ? "…" : backendOk ? "en línea ✓" : "sin conexión ✕"}
        </p>

        <ol className="scanner__steps" aria-label="Pasos del escaneo">
          <li className={step >= 1 ? "is-active" : ""}>1 · Escaneo facial</li>
          <li className={step >= 2 ? "is-active" : ""}>2 · Informe y monturas</li>
          <li className={step >= 3 ? "is-active" : ""}>3 · Escaneo con montura</li>
        </ol>

        {phase === "start" && (
          <section className="glass scanner__intro">
            <h2>Escanea tu rostro en 3 pasos</h2>
            <ul>
              <li><b>Análisis facial:</b> forma del rostro, simetría y medidas estimadas.</li>
              <li><b>Compatibilidad:</b> % por forma, material, color y tipo de lente.</li>
              <li><b>Informe:</b> composición del rostro según el sistema experto, descargable.</li>
            </ul>
            <button type="button" className="btn btn--primary scanner__cta" onClick={() => go("consent")}>
              Iniciar escaneo
            </button>
            <small>Sin monturas en este primer escaneo: primero medimos tu rostro.</small>
          </section>
        )}

        {phase === "consent" && (
          <section className="glass scanner__panel">
            <h2>Consentimiento informado</h2>
            <label className="scanner__consent">
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Acepto el tratamiento de mi imagen para el análisis facial (dato sensible, Ley 1581/2012). La foto se procesa para este análisis y no se almacena en el servidor; el resultado es orientativo.
            </label>
            <div className="scanner__row">
              <button type="button" className="btn btn--primary" disabled={!consent} onClick={() => go("capture")}>
                Continuar
              </button>
              <button type="button" className="btn btn--glass" onClick={() => go("start")}>
                Volver
              </button>
            </div>
          </section>
        )}

        {phase === "capture" && (
          <ScanCapture
            tab={tab}
            onTab={(t) => { setTab(t); if (t === "subir") stopCamera(); }}
            videoRef={videoRef}
            overlayRef={overlayRef}
            threeLiveRef={threeLiveRef}
            livePts={livePts}
            arOk={arOk}
            onStartCamera={startCamera}
            onCapture={() => capture("scan")}
            onUpload={(e) => onUpload(e, "scan")}
            hint="Escaneo del rostro sin monturas: centra tu cara de frente y con buena luz."
          />
        )}

        {phase === "captureFit" && (
          <>
            <div className="glass scanner__fitbar">
              <b>Escaneo con montura</b>
              <span>
                Ponte <b>{fitFrame?.nombre ?? "la montura"}</b> y mira de frente. La foto se usa solo para medir el ajuste.
              </span>
              <button type="button" className="btn btn--glass btn--sm" onClick={() => go("catalog")}>
                Cambiar montura
              </button>
            </div>
            <ScanCapture
              tab={tab}
              onTab={(t) => { setTab(t); if (t === "subir") stopCamera(); }}
              videoRef={videoRef}
              overlayRef={overlayRef}
              threeLiveRef={threeLiveRef}
              livePts={livePts}
              arOk={arOk}
              onStartCamera={startCamera}
              onCapture={() => capture("fit")}
              onUpload={(e) => onUpload(e, "fit")}
              hint="Con la montura puesta, de frente: el sistema medirá centrado, apoyo y compatibilidad."
            />
          </>
        )}

        {phase === "hub" && (
          <>
            <StepCards
              recsCount={recs.length}
              fitFrameName={fitFrame?.nombre ?? ""}
              onReport={() => go("report")}
              onCatalog={() => { setTryOn(true); go("catalog"); }}
              onFitScan={() => go("captureFit")}
            />
            <ScannerMetrics metrics={metrics} loading={loading} onChangeShape={changeShape} />
          </>
        )}

        {phase === "report" && (
          <ScanReport
            mode="scan"
            metrics={metrics}
            detectedShape={detectedShape}
            recs={recs}
            frames={frames}
            scanMeta={scanMeta}
            onClose={() => go("hub")}
          />
        )}

        {phase === "fitReport" && (
          <ScanReport
            mode="fit"
            metrics={fitMetrics}
            detectedShape={fitMetrics?.face_shape}
            recs={fitRecs}
            frames={frames}
            scanMeta={fitMeta}
            frame={fitFrame}
            fitRec={fitRec}
            onClose={() => go("hub")}
          />
        )}

        {phase === "catalog" && (
          <>
            <div className="glass scanner__panel">
              <div className="scanner__row" style={{ justifyContent: "space-between" }}>
                <b>Monturas recomendadas ({recs.length})</b>
                <div className="scanner__row">
                  <button type="button" className="btn btn--glass btn--sm" onClick={() => go("hub")}>
                    ← Volver
                  </button>
                  <button type="button" className="btn btn--glass btn--sm" onClick={() => setLiveOn((v) => !v)}>
                    {liveOn ? "✕ Cerrar cámara" : "🎥 Probar en vivo"}
                  </button>
                </div>
              </div>

              {liveOn && (
                <>
                  <div className="scanner__camwrap">
                    <video ref={videoRef} playsInline muted className="scanner__video" />
                    <canvas ref={overlayRef} className="scanner__overlay" aria-hidden="true" />
                    <canvas ref={threeLiveRef} className="scanner__overlay scanner__overlay--3d" aria-hidden="true" />
                  </div>
                  <div className={`scanner__live ${livePts > 0 ? "scanner__live--ok" : ""}`} role="status" aria-live="polite">
                    <span className="scanner__live-dot" aria-hidden="true" />
                    {livePts > 0 ? `Escaneo en vivo · ${livePts} puntos faciales detectados` : "Escaneo en vivo · buscando tu rostro"}
                  </div>
                  <div className="scanner__row">
                    <button type="button" className="btn btn--glass" onClick={startCamera}>Activar cámara</button>
                    <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                      <input type="checkbox" checked={use3D} onChange={(e) => setUse3D(e.target.checked)} />
                      Armazón 3D real
                    </label>
                  </div>
                  <label className="scanner__live-select">
                    Montura en vivo
                    <select value={tryId} onChange={(e) => setTryId(e.target.value)} aria-label="Montura para cámara en vivo" className="scanner__select">
                      {frames.map((f) => (
                        <option key={f.id} value={f.id}>{f.nombre} · {f.forma}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {preview && (
                <>
                  <h3>Vista previa + probador {arOk ? <span className="tag tag--price">3D real</span> : <span className="tag">2D</span>}</h3>
                  <img ref={photoImgRef} src={preview} alt="rostro para análisis" className="scanner__preview" style={{ display: "none" }} />
                  <div className={`scanner__zoomwrap ${zoomed ? "zoomed" : ""}`}>
                    <canvas ref={photoCanvasRef} className="scanner__preview" onClick={() => setZoomed((z) => !z)} title={zoomed ? "Clic para alejar" : "Clic para ampliar detalle"} />
                    <canvas ref={threePhotoRef} className="scanner__overlay scanner__overlay--3d" aria-hidden="true" />
                  </div>
                  {photoWarn && <p className="scanner__warning">⚠ {photoWarn}</p>}
                  <FrameStrip
                    recs={recs}
                    frames={frames}
                    tryId={tryId}
                    onSelect={(id) => { setTryId(id); setTryOn(true); }}
                  />
                  <small className="scanner__sub">
                    Modelos 3D con licencia CC BY 4.0 · <Link to="/creditos-3d">autores y atribuciones</Link>
                  </small>
                  {fitInfo && (
                    <small className="scanner__sub">
                      Montaje {fitInfo.mode3D ? (fitInfo.modeGlb ? "3D GLB" : "3D") : "2D"}: IPD {fitInfo.ipdPx}px · ángulo {fitInfo.angDeg}°
                      {fitInfo.lensW ? ` · lente ${fitInfo.lensW}×${fitInfo.lensH}px` : ""}
                      {` · escala marco ${fitInfo.fitScale}×`}
                      {fitInfo.yaw != null ? ` · giro ${fitInfo.yaw}°` : ""}
                      {metrics ? ` · sien-sien ${Number(metrics.temporal_est ?? 0).toFixed(1)}mm (est.)` : ""}
                    </small>
                  )}
                  <TryOnDetail
                    frame={tryFrame}
                    recs={recs}
                    tryId={tryId}
                    metrics={metrics}
                    tryLens={tryLens}
                    onSelectLens={setTryLens}
                  />
                  <div className="scanner__row">
                    <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                      <input type="checkbox" checked={tryOn} onChange={(e) => setTryOn(e.target.checked)} />
                      Probador
                    </label>
                    <label className="scanner__opacity" title="Transparencia de la montura">
                      Montura
                      <input type="range" min="0.35" max="1" step="0.05" value={tryOpacity} onChange={(e) => setTryOpacity(Number(e.target.value))} aria-label="Opacidad de la montura" />
                      {Math.round(tryOpacity * 100)}%
                    </label>
                    <button type="button" className="btn btn--glass" onPointerDown={() => setShowOriginal(true)} onPointerUp={() => setShowOriginal(false)} onPointerLeave={() => setShowOriginal(false)} title="Mantén presionado para ver tu foto sin montura">
                      ◐ Comparar original
                    </button>
                    <button type="button" className="btn btn--glass" onClick={() => setZoomed((z) => !z)} title="Alternar zoom detalle">
                      {zoomed ? "🔍 Alejar" : "🔍 Detalle"}
                    </button>
                    <button type="button" className="btn btn--glass" onClick={downloadHD} disabled={!fitInfo} title="Descarga en resolución original">
                      ⬇ Guardar HD
                    </button>
                    <button type="button" className="btn btn--glass" onClick={downloadEvidence} disabled={!fitInfo} title="Descarga foto + JSON con pose y medidas estimadas">
                      🧾 Evidencia
                    </button>
                  </div>

                  <div className="scanner__fitchoose">
                    <div>
                      <b>¿Ya te probaste esta montura?</b>
                      <small>Póntela físicamente y continúa al escaneo con montura (paso 3, obligatorio).</small>
                    </div>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => { setFitFrameId(tryId); go("captureFit"); }}
                    >
                      ✅ Me la probé · Escanear con montura
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="scanner__recs-header">
              <div>
                <h2>Monturas <span className="text-gradient">Recomendadas</span> ({recs.length})</h2>
                <p className="scanner__sub">Compatibilidad evaluada por el motor experto según proporción facial, centrado óptico, contraste geométrico y apoyo nasal.</p>
              </div>
              <Link className="btn btn--glass" to="/piloto" title="Lleva la forma y el top-1 de este análisis al registro del piloto">
                📋 Registrar en piloto →
              </Link>
            </div>
            <div className="scanner__grid">
              {(showAllRecs ? recs : recs.slice(0, RECS_PREVIEW)).map((r) => {
                const f = frames.find((x) => x.id === r.frame_id);
                return (
                  <RecommendationCard
                    key={r.frame_id}
                    rec={r}
                    frame={f}
                    isSelected={tryId === r.frame_id}
                    onSelect={(lens) => {
                      setTryId(r.frame_id);
                      if (lens) setTryLens(lens);
                      setTryOn(true);
                      photoCanvasRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  />
                );
              })}
            </div>
            {recs.length > RECS_PREVIEW && (
              <div className="scanner__recs-more">
                <button type="button" className="btn btn--glass" onClick={() => setShowAllRecs((v) => !v)}>
                  {showAllRecs ? "Ver solo las 12 mejores" : `Ver las ${recs.length} monturas compatibles`}
                </button>
              </div>
            )}
            <FeedbackBox metrics={metrics} top={recs[0]} />
          </>
        )}

        {loading && <p className="scanner__loading" role="status">{loading}</p>}
        {error && <p className="scanner__error">{error}</p>}

        {phase !== "start" && (
          <div className="scanner__row scanner__footer-actions">
            {phase !== "catalog" && phase !== "report" && phase !== "fitReport" && (
              <button type="button" className="btn btn--glass btn--sm" onClick={() => go("hub")} disabled={!metrics}>
                ← Volver al resumen
              </button>
            )}
            <button type="button" className="btn btn--glass btn--sm" onClick={erasePhoto}>
              🗑 Borrar mis fotos y empezar de nuevo
            </button>
          </div>
        )}

        <p className="scanner__sub">
          Probador virtual 3D · Grupo Prisma Visión (formas + ajuste por A/B/D y temporal_est). Usa los GLB de <code>/glasses/manifest.json</code> y, si no cargan, dibuja un armazón procedural con Three.js.
        </p>
      </div>
      <Footer />
    </>
  );
}
