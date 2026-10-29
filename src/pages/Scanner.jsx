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
import { useLiveCameraTryOn } from "../hooks/useLiveCameraTryOn.js";
import { usePhotoTryOn } from "../hooks/usePhotoTryOn.js";
import "./Scanner.css";

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const initialFrame = searchParams.get("frameId");
  const [consent, setConsent] = useState(false);
  const [tab, setTab] = useState("camara"); // camara | subir
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [detectedShape, setDetectedShape] = useState("");
  const [recs, setRecs] = useState([]);
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [backendOk, setBackendOk] = useState(null);
  const [tryOpacity, setTryOpacity] = useState(0.95); // slider montura
  const [tryLens, setTryLens] = useState("monofocal"); // tinte del cristal
  const [use3D, setUse3D] = useState(true); // armazón 3D real con fallback 2D
  const [showOriginal, setShowOriginal] = useState(false); // mantener para comparar
  const [zoomed, setZoomed] = useState(false); // detalle HD
  const [tryOn, setTryOn] = useState(true);
  const [showAllRecs, setShowAllRecs] = useState(false); // ver las 64 monturas
  const RECS_PREVIEW = 12;
  const [tryId, setTryId] = useState(initialFrame || "F01");
  // Sincroniza el frame del query string sin `setState` dentro de un efecto.
  const [prevInitialFrame, setPrevInitialFrame] = useState(initialFrame);
  if (initialFrame !== prevInitialFrame) {
    setPrevInitialFrame(initialFrame);
    if (initialFrame) setTryId(initialFrame);
  }
  const tryFrame = frames.find((x) => x.id === tryId) ?? frames[0];
  const tryLensRef = useRef(tryLens);
  useEffect(() => {
    tryLensRef.current = tryLens;
  }, [tryLens]);
  // Transparencia según modelo: al cambiar de montura (o al llegar el análisis)
  // se monta su lente ideal, el de mayor probabilidad para tu rostro.
  // No depende de tryLens para no pelear con tu elección manual.
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
  // Los motores de try-on leen el ref en cada frame; se actualiza tras el render.
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

  // Liberar los object URL al cambiar de foto o desmontar el escáner.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return setError("Cámara aún no lista. Espera 1 s e intenta de nuevo.");
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return setError("No se pudo capturar. Intenta de nuevo.");
      setFile(new File([b], "captura.jpg", { type: "image/jpeg" }));
      setPreview(URL.createObjectURL(b));
      setMetrics(null);
      setRecs([]);
    }, "image/jpeg", 0.88);
  }

  async function onUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setLoading("Cargando y optimizando imagen…");
    try {
      const normalized = await normalizeImageFile(f);
      setFile(normalized.file);
      setPreview(normalized.previewUrl);
      setMetrics(null);
      setRecs([]);
    } catch {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    } finally {
      setLoading("");
      if (e.target) e.target.value = "";
    }
  }

  async function erasePhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setMetrics(null); setRecs([]); setError(""); setZoomed(false); setShowOriginal(false);
    setDetectedShape("");
    resetPhotoTryOn();
    try { sessionStorage.removeItem("gs_last_scan"); } catch { /* noop */ }
    try {
      const r = await fetch(`${API_URL}/analyze/photo`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      setError(j.msg ?? "Foto borrada de este dispositivo.");
    } catch {
      setError("Foto borrada de este dispositivo (sin conexión al servidor).");
    }
  }

  function downloadEvidence() {
    // Fase 0: evidencia tangible (foto + datos) en vez de adivinar el fallo.
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

  async function runAnalysis() {
    if (!consent) {
      setError("Debes aceptar el tratamiento de datos biométricos (Ley 1581) para continuar.");
      return;
    }
    if (!file) {
      setError(tab === "camara" ? "Captura primero con la cámara." : "Selecciona primero una foto de tu rostro.");
      return;
    }
    setError("");
    setLoading("Analizando proporciones faciales…");
    setMetrics(null);
    setRecs([]);
    setShowAllRecs(false);
    try {
      const m = await analyzePhoto(file);
      if (!m || !m.face_detected) {
        throw new Error(m?.warnings?.[0] || "No se detectó un rostro frontal claro. Asegúrate de mirar de frente y tener buena luz.");
      }
      setMetrics(m);
      setDetectedShape(m.face_shape);
      setLoading("Calculando compatibilidades con el stock…");
      const r = await recommend(m, null);
      const sorted = r.sort((a, b) => b.score - a.score);
      setRecs(sorted);
      saveLastScan(m, sorted, m.face_shape);
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

  return (
    <>
      <Navbar />
      <div className="container scanner">
        <h1>Escáner Facial · <span className="text-gradient">Grupo Prisma Visión</span></h1>
        <p className="scanner__sub">
          Análisis facial · estimaciones orientativas · Backend: <code>{API_URL}</code> · {backendOk === null ? "…" : backendOk ? "en línea ✓" : "sin conexión ✕"}
        </p>

      <label className="glass scanner__consent">
        <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Acepto el tratamiento de mi imagen para el análisis facial (dato sensible, Ley 1581/2012). La foto se procesa para este análisis y no se almacena en el servidor; el resultado es orientativo.
      </label>

      <div className="scanner__tabs glass">
        <button className={tab === "camara" ? "active" : ""} onClick={() => setTab("camara")}>📷 Cámara en vivo</button>
        <button className={tab === "subir" ? "active" : ""} onClick={() => { setTab("subir"); stopCamera(); }}>🖼️ Subir foto</button>
      </div>

      {tab === "camara" ? (
        <div className="glass scanner__panel">
          <div className="scanner__camwrap">
            <video ref={videoRef} playsInline muted className="scanner__video" />
            <canvas ref={overlayRef} className="scanner__overlay" aria-hidden="true" />
            <canvas ref={threeLiveRef} className="scanner__overlay scanner__overlay--3d" aria-hidden="true" />
          </div>
          <small>{livePts > 0 ? `Rostro en vivo: ${livePts} puntos · ${arOk ? "armazón 3D siguiendo tu cabeza" : "probador 2D"} · centra tu cara en el óvalo` : "Activa la cámara y centra tu rostro de frente."}</small>
          <div className="scanner__row">
            <button className="btn btn--glass" onClick={startCamera}>Activar cámara</button>
            <button className="btn btn--primary" onClick={capture}>Capturar</button>
            <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
              <input type="checkbox" checked={use3D} onChange={(e) => setUse3D(e.target.checked)} />
              Armazón 3D real
            </label>
          </div>
          <small>Requiere HTTPS + permiso. En iPhone usa Safari con gesto Capturar. Mové la cabeza: el 3D te sigue.</small>
        </div>
      ) : (
        <div className="glass scanner__panel">
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".5rem", padding: "1.5rem", cursor: "pointer", border: "1px dashed rgba(0,212,255,0.4)", borderRadius: "12px", background: "rgba(0,212,255,0.03)" }}>
            <span style={{ fontSize: "2rem" }}>📁</span>
            <b>Haz clic aquí para seleccionar o arrastrar una foto de tu rostro</b>
            <small style={{ color: "#8892a8" }}>Soporta cualquier formato de foto (JPG, PNG, WebP) de tu dispositivo.</small>
            <input type="file" accept="image/*" onChange={onUpload} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {preview && (
        <div className="glass scanner__panel">
          <h3>Vista previa + probador {arOk ? <span className="tag tag--price">3D real</span> : <span className="tag">2D</span>}</h3>
          <img ref={photoImgRef} src={preview} alt="rostro para análisis" className="scanner__preview" style={{ display: "none" }} />
          <div className={`scanner__zoomwrap ${zoomed ? "zoomed" : ""}`}>
            <canvas ref={photoCanvasRef} className="scanner__preview" onClick={() => setZoomed((z) => !z)} title={zoomed ? "Clic para alejar" : "Clic para ampliar detalle"} />
            <canvas ref={threePhotoRef} className="scanner__overlay scanner__overlay--3d" aria-hidden="true" />
          </div>
          {photoWarn && <p className="scanner__warning">⚠ {photoWarn}</p>}
          <small className="scanner__sub">
            Modelos 3D con licencia CC BY 4.0 · <Link to="/creditos-3d">autores y atribuciones</Link>
          </small>
          {fitInfo && (
            <small className="scanner__sub">
              Montaje {fitInfo.mode3D ? (fitInfo.modeGlb ? "3D GLB" : "3D") : "2D"}: IPD {fitInfo.ipdPx}px · ángulo {fitInfo.angDeg}°
              {fitInfo.lensW ? ` · lente ${fitInfo.lensW}×${fitInfo.lensH}px` : ""}
              {` · escala marco ${fitInfo.fitScale}×`}
              {fitInfo.yaw != null ? ` · giro ${fitInfo.yaw}°` : ""}
              {metrics ? ` · sien-sien ${Number(metrics.temporal_est ?? 0).toFixed(1)}mm (est.)` : " · analizá para ver medidas estimadas"}
              {fitInfo.decent && (fitInfo.decent.ok
                ? ` · pupilas centradas ✓ (A+D ${fitInfo.decent.framePD}mm vs IPD ${metrics?.ipd_mm_est ?? "?"}mm)`
                : ` · ⚠ pupila descentrada ${fitInfo.decent.perEye}mm por ojo`)}
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
            <button
              className="btn btn--glass"
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              title="Mantén presionado para ver tu foto sin montura"
            >
              ◐ Comparar original
            </button>
            <button className="btn btn--glass" onClick={() => setZoomed((z) => !z)} title="Alternar zoom detalle">
              {zoomed ? "🔍 Alejar" : "🔍 Detalle"}
            </button>
          </div>
          <div className="scanner__row">
            <select value={tryId} onChange={(e) => setTryId(e.target.value)} aria-label="Marco para probar" className="scanner__select">
              {(recs.length ? [...recs].sort((a, b) => b.score - a.score).map((r) => frames.find((x) => x.id === r.frame_id)).filter(Boolean).map((f) => {
                const r = recs.find((x) => x.frame_id === f.id);
                return { f, r };
              }) : frames.map((f) => ({ f, r: null }))).map(({ f, r }) => (
                <option key={f.id} value={f.id}>
                  {r ? `${r.verdict === "compatible" ? "✓" : r.verdict === "parcial" ? "~" : "✕"} ${r.score}pts · ${f.nombre} (${f.forma})` : `${f.nombre} · ${f.forma}`}
                </option>
              ))}
            </select>
            <button className="btn btn--primary" onClick={runAnalysis} disabled={!!loading || !consent} title={!consent ? "Acepta el consentimiento para analizar la foto" : undefined}>
              {loading || "Analizar compatibilidad"}
            </button>
            <button className="btn btn--glass" onClick={downloadHD} disabled={!fitInfo} title="Descarga en resolución original">
              ⬇ Guardar HD
            </button>
            <button className="btn btn--glass" onClick={downloadEvidence} disabled={!fitInfo} title="Descarga foto + JSON con pose y medidas estimadas para diagnosticar">
              🧾 Evidencia
            </button>
            <button className="btn btn--glass" onClick={erasePhoto} disabled={!!loading}>
              🗑 Borrar mi foto
            </button>
          </div>
        </div>
      )}

      {error && <p className="scanner__error">{error}</p>}

      <ScannerMetrics metrics={metrics} loading={loading} onChangeShape={changeShape} />

      {recs.length > 0 && (
        <>
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
            <button className="btn btn--glass" onClick={() => setShowAllRecs((v) => !v)}>
              {showAllRecs
                ? "Ver solo las 12 mejores"
                : `Ver las ${recs.length} monturas compatibles`}
            </button>
          </div>
        )}
        <FeedbackBox metrics={metrics} top={recs[0]} />
        </>
      )}

      <p className="scanner__sub">Probador virtual 3D · Grupo Prisma Visión (formas + ajuste por A/B/D y temporal_est). Usa los GLB de <code>/glasses/manifest.json</code> y, si no cargan, dibuja un armazón procedural con Three.js.</p>
    </div>
    <Footer />
    </>
  );
}
