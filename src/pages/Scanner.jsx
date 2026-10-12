import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { analyzePhoto, recommend, listFrames, API_URL } from "../lib/api.js";
import { drawGlasses } from "../components/tryon/GlassesOverlay.js";
import { renderGLB } from "../components/tryon/GlassesGLB.js";
import "./Scanner.css";

function FeedbackBox({ metrics, top }) {
  const [v, setV] = useState(0);
  const [done, setDone] = useState(false);
  if (done) return <p className="glass scanner__panel">¡Gracias! Tu voto ayuda a calibrar el sistema. ✓</p>;
  return (
    <div className="glass scanner__panel">
      <b>¿La explicación te ayudó a decidir? </b>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} className="btn btn--glass" style={{ margin: ".2rem", opacity: v === n ? 1 : 0.6 }} onClick={() => setV(n)}>{n}★</button>
      ))}
      <button
        className="btn btn--primary" disabled={!v}
        onClick={async () => {
          await fetch(`${API_URL}/feedback`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ face_shape: metrics?.face_shape ?? "oval", frame_id: top?.frame_id ?? "F01", verdict: top?.verdict ?? "compatible", helpful: v }),
          }).catch(() => {});
          setDone(true);
        }}
      >Enviar</button>
    </div>
  );
}

const MAX_MB = 15;

async function normalizeImageFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1280;
      let w = img.naturalWidth || img.width || 640;
      let h = img.naturalHeight || img.height || 480;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const normalizedFile = new File([blob], "rostro.jpg", { type: "image/jpeg" });
            resolve({ file: normalizedFile, previewUrl: URL.createObjectURL(blob) });
          } else {
            resolve({ file, previewUrl: URL.createObjectURL(file) });
          }
        },
        "image/jpeg",
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, previewUrl: URL.createObjectURL(file) });
    };
    img.src = url;
  });
}

export default function Scanner() {
  const [searchParams] = useSearchParams();
  const initialFrame = searchParams.get("frameId");
  const [consent, setConsent] = useState(true);
  const [tab, setTab] = useState("camara"); // camara | subir
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [recs, setRecs] = useState([]);
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [backendOk, setBackendOk] = useState(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const imgLandmarkerRef = useRef(null);
  const lastLmRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const photoImgRef = useRef(null);
  const glbCanvasRef = useRef(null);
  const [glb3d, setGlb3d] = useState(null); // null=probando, true=GLB, false=procedural
  const rafRef = useRef(0);
  const [livePts, setLivePts] = useState(0);
  const [tryOn, setTryOn] = useState(true);
  const [tryId, setTryId] = useState(initialFrame || "F01");
  const tryFrame = frames.find((x) => x.id === tryId) ?? frames[0];
  const tryRef = useRef({ on: true, forma: "rectangular" });
  tryRef.current = { on: tryOn, forma: tryFrame?.forma ?? "rectangular" };

  useEffect(() => {
    if (initialFrame) setTryId(initialFrame);
  }, [initialFrame]);

  useEffect(() => {
    fetch(`${API_URL}/health`).then(() => setBackendOk(true)).catch(() => setBackendOk(false));
    listFrames().then(setFrames).catch(() => {});
    return () => stopCamera();
  }, []);

  async function startCamera() {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
      // Overlay landmarks en vivo (progresivo, no bloquea si falla la red/CDN)
      startLiveLandmarks().catch(() => {});
    } catch {
      setError("No se pudo abrir la cámara (permiso, HTTPS o sin cámara). Usa la pestaña Subir foto.");
    }
  }

  async function startLiveLandmarks() {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    const loop = async () => {
      const v = videoRef.current;
      const cnv = overlayRef.current;
      if (v && cnv && v.videoWidth && landmarkerRef.current) {
        cnv.width = v.clientWidth || v.videoWidth;
        cnv.height = v.clientHeight || v.videoHeight;
        try {
          const res = landmarkerRef.current.detectForVideo(v, performance.now());
          const pts = res?.faceLandmarks?.[0]?.length ?? 0;
          setLivePts(pts);
          const ctx = cnv.getContext("2d");
          ctx.clearRect(0, 0, cnv.width, cnv.height);
          if (pts > 0) {
            const lm = res.faceLandmarks[0];
            lastLmRef.current = lm;
            const t = tryRef.current;
            if (t.on) {
              drawGlasses(ctx, lm, v.videoWidth, v.videoHeight, cnv.width, cnv.height, t.forma);
            } else {
              ctx.fillStyle = "rgba(0,212,255,.8)";
              const sx = cnv.width / v.videoWidth;
              const sy = cnv.height / v.videoHeight;
              for (let i = 0; i < lm.length; i += 6) {
                ctx.beginPath();
                ctx.arc(lm[i].x * v.videoWidth * sx, lm[i].y * v.videoHeight * sy, 1.6, 0, 7);
                ctx.fill();
              }
            }
          }
        } catch { /* un frame fallido no rompe el loop */ }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(rafRef.current);
    loop();
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Try-on en foto capturada/subida (IMAGE mode, reutiliza el mismo CDN)
  useEffect(() => {
    if (!preview) return;
    let dead = false;
    (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        if (!imgLandmarkerRef.current) {
          const fileset = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
          );
          if (dead) return;
          imgLandmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "IMAGE",
            numFaces: 1,
          });
        }
        const img = photoImgRef.current;
        const cnv = photoCanvasRef.current;
        if (!img || !cnv) return;
        await new Promise((r) => {
          if (img.complete && img.naturalWidth) return r();
          img.onload = () => r();
          img.onerror = () => r();
        });
        if (dead) return;
        const W = img.naturalWidth, H = img.naturalHeight;
        const maxW = 640;
        const sc = Math.min(1, maxW / W);
        cnv.width = Math.round(W * sc);
        cnv.height = Math.round(H * sc);
        const ctx = cnv.getContext("2d");
        ctx.clearRect(0, 0, cnv.width, cnv.height);
        ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
        if (!tryRef.current.on) return;
        const res = imgLandmarkerRef.current.detect(img);
        const lm = res?.faceLandmarks?.[0];
        if (lm) drawGlasses(ctx, lm, W, H, cnv.width, cnv.height, tryRef.current.forma, "#c839ff");
        // Vista 3D fotorrealista si la óptica subió el GLB; si no, queda oculta.
        try {
          const g = glbCanvasRef.current;
          if (g) {
            const ok = await renderGLB(g, { forma: tryRef.current.forma, ipdPx: 100 }).catch(() => false);
            setGlb3d(ok ? true : false);
          }
        } catch { setGlb3d(false); }
      } catch { /* foto sin try-on sigue permitiendo análisis */ }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, tryId, tryOn]);

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
    setFile(null); setPreview(null); setMetrics(null); setRecs([]); setError("");
    try {
      const r = await fetch(`${API_URL}/analyze/photo`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      setError(j.msg ?? "Foto borrada de este dispositivo.");
    } catch {
      setError("Foto borrada de este dispositivo (sin conexión al servidor).");
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
    setLoading("Analizando geometría facial con IA…");
    setMetrics(null);
    setRecs([]);
    try {
      const m = await analyzePhoto(file);
      if (!m || !m.face_detected) {
        throw new Error(m?.warnings?.[0] || "No se detectó un rostro frontal claro. Asegúrate de mirar de frente y tener buena luz.");
      }
      setMetrics(m);
      setLoading("Calculando compatibilidades con el stock…");
      const r = await recommend(m, null);
      setRecs(r.sort((a, b) => b.score - a.score));
    } catch (e) {
      const msg = e.name === "AbortError"
        ? "El servidor tardó en responder. Por favor intenta de nuevo."
        : (e.message || "Error al analizar la imagen.");
      setError(msg);
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="container scanner">
      <h1>Escáner <span className="text-gradient">Glassescanner</span></h1>
      <p className="scanner__sub">
        Backend: <code>{API_URL}</code> · {backendOk === null ? "…" : backendOk ? "en línea ✓" : "sin conexión ✕"}
      </p>

      <label className="glass scanner__consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Acepto el tratamiento de mi imagen para análisis facial (dato sensible, Ley 1581/2012). Puedo pedir el borrado en cualquier momento.
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
          </div>
          <small>{livePts > 0 ? `Rostro en vivo: ${livePts} puntos · centra tu cara en el óvalo` : "Activa la cámara y centra tu rostro de frente."}</small>
          <div className="scanner__row">
            <button className="btn btn--glass" onClick={startCamera}>Activar cámara</button>
            <button className="btn btn--primary" onClick={capture}>Capturar</button>
          </div>
          <small>Requiere HTTPS + permiso. En iPhone usa Safari con gesto Capturar.</small>
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
          <h3>Vista previa + probador</h3>
          <img ref={photoImgRef} src={preview} alt="rostro para análisis" className="scanner__preview" style={{ display: "none" }} />
          <canvas ref={photoCanvasRef} className="scanner__preview" />
          <canvas ref={glbCanvasRef} className="scanner__preview" style={{ display: glb3d ? undefined : "none" }} aria-label="Vista 3D fotorrealista" />
          <div className="scanner__row">
            <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
              <input type="checkbox" checked={tryOn} onChange={(e) => setTryOn(e.target.checked)} />
              Probador
            </label>
            <select value={tryId} onChange={(e) => setTryId(e.target.value)} aria-label="Marco para probar">
              {(recs.length ? recs.map((r) => frames.find((x) => x.id === r.frame_id)).filter(Boolean) : frames).map((f) => (
                <option key={f.id} value={f.id}>{f.nombre} · {f.forma}</option>
              ))}
            </select>
            <button className="btn btn--primary" onClick={runAnalysis} disabled={!!loading}>
              {loading || "Analizar compatibilidad"}
            </button>
            <button className="btn btn--glass" onClick={erasePhoto} disabled={!!loading}>
              🗑 Borrar mi foto
            </button>
          </div>
          {error && <p className="scanner__error" style={{ margin: ".3rem 0 0" }}>{error}</p>}
        </div>
      )}

      {error && <p className="scanner__error">{error}</p>}

      {metrics && (
        <div className="glass scanner__panel scanner__metrics">
          <div className="scanner__metrics-header">
            <h3>🔬 Análisis Morfométrico Facial</h3>
            <span className="badge badge--cyan">Forma: {metrics.face_shape.toUpperCase()}</span>
          </div>
          <div className="scanner__metrics-grid">
            <div className="metric-chip">
              <span className="metric-label">Simetría Facial</span>
              <span className="metric-val">{metrics.symmetry_index}%</span>
            </div>
            <div className="metric-chip">
              <span className="metric-label">Distancia Pupilar (IPD)</span>
              <span className="metric-val">{metrics.ipd_mm_est} mm</span>
            </div>
            <div className="metric-chip">
              <span className="metric-label">Ancho Facial Sien-Sien</span>
              <span className="metric-val">{metrics.temporal_est ?? 138} mm</span>
            </div>
            <div className="metric-chip">
              <span className="metric-label">Puente Nasal Anatómico</span>
              <span className="metric-val">{metrics.nose_bridge_mm_est ?? 18} mm</span>
            </div>
            <div className="metric-chip">
              <span className="metric-label">Proporción Largo/Ancho</span>
              <span className="metric-val">{metrics.ratios?.largo_ancho ?? 1.3}</span>
            </div>
            <div className="metric-chip">
              <span className="metric-label">Zona de Cejas</span>
              <span className="metric-val">{metrics.eyebrow_in_frame_zone ? "Despejada ✓" : "Atención"}</span>
            </div>
          </div>
          {metrics.warnings?.map((w) => <p key={w} className="scanner__warning">⚠ {w}</p>)}
        </div>
      )}

      {recs.length > 0 && (
        <>
        <div className="scanner__recs-header">
          <h2>Monturas <span className="text-gradient">Recomendadas</span> ({recs.length})</h2>
          <p className="scanner__sub">Compatibilidad evaluada por el motor experto según proporción facial, contraste geométrico y apoyo nasal.</p>
        </div>
        <div className="scanner__grid">
          {recs.slice(0, 12).map((r) => {
            const f = frames.find((x) => x.id === r.frame_id);
            const isSelected = tryId === r.frame_id;
            return (
              <div key={r.frame_id} className={`glass scanner__card verdict--${r.verdict} ${isSelected ? "scanner__card--selected" : ""}`}>
                <div className="scanner__card-top">
                  <span className={`badge-verdict verdict-badge--${r.verdict}`}>
                    {r.verdict === "compatible" ? "✓ Compatible" : r.verdict === "parcial" ? "~ Parcial" : "✕ Incompatible"}
                  </span>
                  <span className="scanner__card-score">{r.score} pts</span>
                </div>

                <h4 className="scanner__card-title">{f?.nombre ?? r.frame_id}</h4>
                <div className="scanner__card-meta">
                  <span className="tag">{f?.forma}</span>
                  <span className="tag">{f?.marca ?? "OptiVision"}</span>
                  <span className="tag tag--highlight">{f?.estilo}</span>
                  <span className="tag">Talla {f?.talla ?? "M"}</span>
                  {f?.precio_rango && <span className="tag tag--price">{f.precio_rango}</span>}
                </div>

                <div className="scanner__card-specs">
                  <span>Calibre A: <b>{f?.A_mm}mm</b></span>
                  <span>Alto B: <b>{f?.B_mm}mm</b></span>
                  <span>Puente D: <b>{f?.D_mm}mm</b></span>
                  <span>Total: <b>{f?.ancho_total_mm}mm</b></span>
                </div>

                {f?.tipo_lente && f.tipo_lente.length > 0 && (
                  <div className="scanner__card-lentes">
                    <small>Lentes compatibles:</small>
                    <div className="lentes-tags">
                      {f.tipo_lente.slice(0, 3).map((tl) => (
                        <span key={tl} className="lente-tag">{tl}</span>
                      ))}
                      {f.tipo_lente.length > 3 && <span className="lente-tag">+{f.tipo_lente.length - 3}</span>}
                    </div>
                  </div>
                )}

                <ul className="scanner__card-reasons">
                  {r.reasons.map((x) => <li key={x}>{x}</li>)}
                </ul>

                <button
                  className={`btn btn--sm ${isSelected ? "btn--primary" : "btn--glass"} scanner__card-btn`}
                  onClick={() => {
                    setTryId(r.frame_id);
                    setTryOn(true);
                    if (photoCanvasRef.current) {
                      photoCanvasRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                >
                  {isSelected ? "👓 Probando ahora" : "👓 Probar en probador virtual"}
                </button>
              </div>
            );
          })}
        </div>
        <FeedbackBox metrics={metrics} top={recs[0]} />
        </>
      )}

      <p className="scanner__sub">Probador procedural v1 (6 formas). v1.1: modelos GLB fotorrealistas en <code>public/glasses/*.glb</code> con Three.js sobre este mismo veredicto.</p>
    </div>
  );
}
