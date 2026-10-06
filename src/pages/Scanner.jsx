import { useEffect, useRef, useState } from "react";
import { analyzePhoto, recommend, listFrames, API_URL } from "../lib/api.js";
import { drawGlasses } from "../components/tryon/GlassesOverlay.js";
import { renderGLB } from "../components/tryon/GlassesGLB.js";
import "./Scanner.css";

const MAX_MB = 5;

export default function Scanner() {
  const [consent, setConsent] = useState(false);
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
  const [tryId, setTryId] = useState("F01");
  const tryFrame = frames.find((x) => x.id === tryId) ?? frames[0];
  const tryRef = useRef({ on: true, forma: "rectangular" });
  tryRef.current = { on: tryOn, forma: tryFrame?.forma ?? "rectangular" };

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
        await new Promise((r) => (img.complete && img.naturalWidth ? r() : (img.onload = r)));
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
    }, "image/jpeg", 0.85);
  }

  function onUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) return setError(`La foto supera ${MAX_MB} MB.`);
    if (!/image\/(jpeg|png|webp)/.test(f.type)) return setError("Formato válido: JPG/PNG/WebP.");
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
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

  async function runAnalysis() {    if (!consent) return setError("Debes aceptar el tratamiento de datos biométricos (Ley 1581).");
    if (!file) return setError(tab === "camara" ? "Captura primero con la cámara." : "Sube primero una foto.");
    setError(""); setLoading("Analizando rostro…"); setMetrics(null); setRecs([]);
    try {
      const m = await analyzePhoto(file);
      if (!m.face_detected) throw new Error("No se detectó rostro frontal. Acércate a la luz y mira de frente.");
      setMetrics(m);
      setLoading("Generando compatibilidades…");
      const r = await recommend(m, null);
      setRecs(r.sort((a, b) => b.score - a.score));
    } catch (e) {
      setError(e.name === "AbortError" ? "El backend tardó >12 s (¿Render dormido?). Reintenta." : e.message);
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
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUpload} />
          <small>JPG/PNG/WebP ≤ {MAX_MB} MB, de frente, sin gafas oscuras.</small>
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
            <button className="btn btn--glass" onClick={erasePhoto}>
              🗑 Borrar mi foto
            </button>
          </div>
        </div>
      )}

      {error && <p className="scanner__error">{error}</p>}

      {metrics && (
        <div className="glass scanner__panel">
          <h3>Tu morfología</h3>
          <p>Rostro: <b>{metrics.face_shape}</b> · Simetría: <b>{metrics.symmetry_index}</b>/100 · IPD est: <b>{metrics.ipd_mm_est} mm</b></p>
          {metrics.warnings?.map((w) => <small key={w}>⚠ {w}<br /></small>)}
        </div>
      )}

      {recs.length > 0 && (
        <div className="scanner__grid">
          {recs.slice(0, 6).map((r) => {
            const f = frames.find((x) => x.id === r.frame_id);
            return (
              <div key={r.frame_id} className={`glass scanner__card verdict--${r.verdict}`}>
                <h4>{r.verdict === "compatible" ? "✓ Compatible" : r.verdict === "parcial" ? "~ Parcial" : "✕ Incompatible"} · {r.score}</h4>
                <p><b>{f?.nombre ?? r.frame_id}</b> ({f?.forma}) — {f?.ancho_total_mm} mm</p>
                <ul>{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            );
          })}
        </div>
      )}

      <p className="scanner__sub">Probador procedural v1 (6 formas). v1.1: modelos GLB fotorrealistas en <code>public/glasses/*.glb</code> con Three.js sobre este mismo veredicto.</p>
    </div>
  );
}
