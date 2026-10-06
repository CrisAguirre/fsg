import { useEffect, useRef, useState } from "react";
import { analyzePhoto, recommend, listFrames, API_URL } from "../lib/api.js";
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
  const streamRef = useRef(null);

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
      // Preview landmarks (progresivo): Tasks-Vision LIVE_STREAM se activa en S2 sin bloquear.
      import("@mediapipe/tasks-vision").catch(() => {});
    } catch {
      setError("No se pudo abrir la cámara (permiso, HTTPS o sin cámara). Usa la pestaña Subir foto.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

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

  async function runAnalysis() {
    if (!consent) return setError("Debes aceptar el tratamiento de datos biométricos (Ley 1581).");
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
          <video ref={videoRef} playsInline muted className="scanner__video" />
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
          <h3>Vista previa</h3>
          <img src={preview} alt="rostro para análisis" className="scanner__preview" />
          <div className="scanner__row">
            <button className="btn btn--primary" onClick={runAnalysis} disabled={!!loading}>
              {loading || "Analizar compatibilidad"}
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

      <p className="scanner__sub">Try-on 3D (Three.js GLB en <code>public/glasses/*.glb</code>, escala por IPD, anclaje puente) se monta en S4 sobre este mismo veredicto.</p>
    </div>
  );
}
