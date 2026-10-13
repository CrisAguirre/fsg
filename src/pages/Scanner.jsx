import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { analyzePhoto, recommend, listFrames, API_URL } from "../lib/api.js";
import { drawGlasses, smoothLandmarks, measureGlasses, pupilDecentration } from "../components/tryon/GlassesOverlay.js";
import { renderGLB } from "../components/tryon/GlassesGLB.js";
import { GlassesAR } from "../components/tryon/Frame3D.js";
import "./Scanner.css";

function sampleBrightness(canvas) {
  try {
    const sw = 48, sh = 48;
    const tmp = document.createElement("canvas");
    tmp.width = sw; tmp.height = sh;
    tmp.getContext("2d").drawImage(canvas, 0, 0, sw, sh);
    const d = tmp.getContext("2d").getImageData(0, 0, sw, sh).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    return sum / (d.length / 4);
  } catch { return 0.5; }
}

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

// Compatibilidad lente ↔ montura ↔ rostro (óptica real, no lista genérica).
// En vez de mostrar todos los tipos existentes, se califica cada tipo del
// catálogo según la montura elegida (B/D) y el veredicto del rostro.
const LENTES_ORDEN = ["monofocal", "blue-cut", "fotocromático", "polarizado", "bifocal", "progresivo"];
const LENTE_SWATCH = {
  "monofocal": "#cfe0f0",
  "blue-cut": "#d9a93f",
  "fotocromático": "#646a76",
  "polarizado": "#232f38",
  "bifocal": "#9dc0e6",
  "progresivo": "#9dc0e6",
};
function LenteDot({ tipo }) {
  const c = LENTE_SWATCH[tipo] || "#cfe0f0";
  return <span title={`Tinte ${tipo}`} style={{ display: "inline-block", width: ".8em", height: ".8em", borderRadius: "50%", background: c, border: "1px solid rgba(255,255,255,.5)", verticalAlign: "baseline" }} />;
}
function lensCompatibility(frame, frameScore = null) {
  if (!frame) return [];
  const B = Number(frame.B_mm ?? 0);
  const offered = new Set(frame.tipo_lente || []);
  const base = frameScore ?? 80;
  const rows = [];
  for (const tipo of LENTES_ORDEN) {
    if (!offered.has(tipo)) continue; // la montura no lo ofrece: no se muestra
    let estado = "compatible", motivo = "Compatible con esta montura.", pen = 0;
    if (tipo === "progresivo") {
      if (B < 28) { estado = "incompatible"; motivo = `Requiere altura B≥28mm (esta: ${B}mm).`; pen = 45; }
      else if (B < 30) { estado = "parcial"; motivo = `B=${B}mm justo para progresivo (ideal ≥30mm).`; pen = 12; }
      else { motivo = `B=${B}mm permite corredor progresivo amplio.`; }
    } else if (tipo === "bifocal") {
      if (B < 26) { estado = "incompatible"; motivo = `Requiere altura B≥26mm (esta: ${B}mm).`; pen = 40; }
      else { motivo = `B=${B}mm admite segmento bifocal.`; }
    } else if (tipo === "fotocromático" && frame.forma === "rimless") {
      estado = "parcial"; motivo = "En rimless exige perforado especial."; pen = 12;
    } else if (tipo === "polarizado" && frame.forma === "rimless") {
      estado = "parcial"; motivo = "En rimless, fijación delicada para polarizado."; pen = 10;
    } else if (tipo === "blue-cut") {
      motivo = "Filtro luz azul sin exigencia geométrica.";
    } else if (tipo === "monofocal") {
      motivo = "Se adapta a cualquier geometría.";
    } else if (tipo === "polarizado") {
      motivo = "Ideal sol/conducción en esta montura.";
    }
    rows.push({ tipo, estado, motivo, prob: Math.max(5, Math.min(99, Math.round(base - pen))) });
  }
  return rows.sort((a, b) => b.prob - a.prob);
}

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
  const smoothLmRef = useRef(null); // anti-temblor en vivo
  const lastPhotoLmRef = useRef(null); // landmarks foto para descarga HD
  const photoNatRef = useRef(null); // tamaño natural para descarga HD
  const photoCanvasRef = useRef(null);
  const photoImgRef = useRef(null);
  const glbCanvasRef = useRef(null);
  const [glb3d, setGlb3d] = useState(null); // null=probando, true=GLB, false=procedural
  const [fitInfo, setFitInfo] = useState(null); // {ipdPx, angDeg, fitScale, warnings[]}
  const [photoWarn, setPhotoWarn] = useState("");
  const [tryOpacity, setTryOpacity] = useState(0.95); // slider montura
  const [tryLens, setTryLens] = useState("monofocal"); // tinte del cristal
  const [use3D, setUse3D] = useState(true); // armazón 3D real con fallback 2D
  const [arOk, setArOk] = useState(null); // null=sin probar, true=3D activo, false=fallback 2D
  const threeLiveRef = useRef(null);
  const threePhotoRef = useRef(null);
  const arLiveRef = useRef(null);
  const arPhotoRef = useRef(null);
  const [showOriginal, setShowOriginal] = useState(false); // mantener para comparar
  const [zoomed, setZoomed] = useState(false); // detalle HD
  const rafRef = useRef(0);
  const [livePts, setLivePts] = useState(0);
  const [tryOn, setTryOn] = useState(true);
  const [tryId, setTryId] = useState(initialFrame || "F01");
  const tryFrame = frames.find((x) => x.id === tryId) ?? frames[0];
  const tryLensRef = useRef(tryLens);
  tryLensRef.current = tryLens;
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
  const tryRef = useRef({ on: true, forma: "rectangular", frame: null, metrics: null, alpha: 0.95, tint: "monofocal", use3D: true });
  tryRef.current = { on: tryOn && !showOriginal, forma: tryFrame?.forma ?? "rectangular", frame: tryFrame ?? null, metrics, alpha: tryOpacity, tint: tryLens, use3D };

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
        // Usar resolución real del video (no clientWidth) para no deformar el montaje.
        // El CSS (.scanner__overlay 100%) se encarga del escalado visual.
        cnv.width = v.videoWidth;
        cnv.height = v.videoHeight;
        try {
          const res = landmarkerRef.current.detectForVideo(v, performance.now());
          const pts = res?.faceLandmarks?.[0]?.length ?? 0;
          setLivePts(pts);
          const ctx = cnv.getContext("2d");
          ctx.clearRect(0, 0, cnv.width, cnv.height);
          if (pts > 0) {
            const raw = res.faceLandmarks[0];
            const lm = smoothLandmarks(smoothLmRef.current, raw, 0.55);
            smoothLmRef.current = lm;
            lastLmRef.current = lm;
            const t = tryRef.current;
            // El 3D vive en su propio canvas; el 2D queda como fallback
            if (t.on) {
              let drew3D = false;
              if (t.use3D && t.frame) {
                try {
                  if (!arLiveRef.current && threeLiveRef.current) arLiveRef.current = new GlassesAR(threeLiveRef.current);
                  const ar = arLiveRef.current;
                  if (ar) {
                    ar.setModel(t.frame, t.tint, t.metrics);
                    const pose = ar.render(lm, cnv.width, cnv.height);
                    drew3D = !!pose;
                  }
                } catch { drew3D = false; }
              }
              setArOk((prev) => (prev === drew3D ? prev : drew3D));
              if (!drew3D) {
                try { arLiveRef.current?.clear(); } catch { /* noop */ }
                drawGlasses(ctx, lm, v.videoWidth, v.videoHeight, cnv.width, cnv.height, t.forma, undefined, { frame: t.frame, metrics: t.metrics, alpha: t.alpha, light: 0.55, tint: t.tint });
              }
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
    smoothLmRef.current = null;
    try { arLiveRef.current?.clear(); } catch { /* noop */ }
  }

  // Try-on en foto capturada/subida (IMAGE mode, reutiliza el mismo CDN)
  useEffect(() => {
    if (!preview) return;
    let dead = false;
    (async () => {
      setPhotoWarn("");
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
        photoNatRef.current = { W, H };
        const maxW = 960; // HD para zoom detalle (antes 640 precario)
        const sc = Math.min(1, maxW / W);
        cnv.width = Math.round(W * sc);
        cnv.height = Math.round(H * sc);
        const ctx = cnv.getContext("2d");
        ctx.clearRect(0, 0, cnv.width, cnv.height);
        ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
        const light = sampleBrightness(cnv);
        if (!tryRef.current.on) {
          setFitInfo(null); lastPhotoLmRef.current = null;
          try { arPhotoRef.current?.clear(); } catch { /* noop */ }
          return;
        }
        const res = imgLandmarkerRef.current.detect(img);
        const lm = res?.faceLandmarks?.[0];
        if (!lm) {
          setFitInfo(null);
          try { arPhotoRef.current?.clear(); } catch { /* noop */ }
          setPhotoWarn("No se detectó rostro en esta foto. Usa foto frontal, con buena luz, sin gafas oscuras.");
          return;
        }
        const t = tryRef.current;
        // 3D real primero; 2D solo como fallback
        let drew3D = false, pose3D = null;
        if (t.use3D && t.frame && threePhotoRef.current) {
          try {
            if (!arPhotoRef.current) arPhotoRef.current = new GlassesAR(threePhotoRef.current);
            arPhotoRef.current.setModel(t.frame, t.tint, t.metrics);
            pose3D = arPhotoRef.current.render(lm, cnv.width, cnv.height);
            drew3D = !!pose3D;
          } catch { drew3D = false; }
        }
        setArOk((prev) => (prev === drew3D ? prev : drew3D));
        // Medidas para la ficha (independientes del render)
        const meas = measureGlasses(lm, cnv.width, cnv.height);
        let fit = null;
        if (!drew3D) {
          try { arPhotoRef.current?.clear(); } catch { /* noop */ }
          fit = drawGlasses(ctx, lm, W, H, cnv.width, cnv.height, t.forma, undefined, { frame: t.frame, metrics: t.metrics, alpha: t.alpha, light, tint: t.tint });
        }
        if (!dead) {
          lastPhotoLmRef.current = lm;
          if (drew3D && meas) {
            const decent = pupilDecentration(t.frame, t.metrics);
            let fitScale = 1;
            if (t.frame?.ancho_total_mm && t.metrics?.temporal_est) {
              fitScale = Math.min(1.25, Math.max(0.85, t.frame.ancho_total_mm / t.metrics.temporal_est));
            }
            setFitInfo({ ipdPx: Math.round(meas.ipdPx), angDeg: Number(meas.angDeg.toFixed(1)), fitScale: Number(fitScale.toFixed(2)), warnings: meas.warnings, lensW: null, lensH: null, light: Number(light.toFixed(2)), decent: decent ?? null, mode3D: true, yaw: pose3D ? Number(pose3D.yawDeg.toFixed(0)) : null });
            if (meas.warnings?.length) setPhotoWarn(meas.warnings.join(" · "));
          } else {
            setFitInfo(fit ? { ipdPx: Math.round(fit.ipdPx), angDeg: Number(fit.angDeg.toFixed(1)), fitScale: Number(fit.fitScale.toFixed(2)), warnings: fit.warnings, lensW: Math.round(fit.lensW), lensH: Math.round(fit.lensH), light: Number(light.toFixed(2)), decent: fit.decent ?? null, mode3D: false } : null);
            if (fit?.warnings?.length) setPhotoWarn(fit.warnings.join(" · "));
          }
        }
        // Vista 3D fotorrealista si la óptica subió el GLB; si no, queda oculta.
        try {
          const g = glbCanvasRef.current;
          if (g) {
            const ipdPx = fit?.ipdPx ?? 100;
            const ok = await renderGLB(g, { forma: t.forma, ipdPx }).catch(() => false);
            if (!dead) setGlb3d(ok ? true : false);
          }
        } catch { if (!dead) setGlb3d(false); }
      } catch { /* foto sin try-on sigue permitiendo análisis */ }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, tryId, tryOn, metrics, tryOpacity, tryLens, showOriginal]);

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
    setFile(null); setPreview(null); setMetrics(null); setRecs([]); setError(""); setFitInfo(null); setPhotoWarn(""); setZoomed(false); setShowOriginal(false);
    lastPhotoLmRef.current = null; smoothLmRef.current = null;
    try { arPhotoRef.current?.clear(); } catch { /* noop */ }
    try {
      const r = await fetch(`${API_URL}/analyze/photo`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      setError(j.msg ?? "Foto borrada de este dispositivo.");
    } catch {
      setError("Foto borrada de este dispositivo (sin conexión al servidor).");
    }
  }

  function downloadMontage() {
    // Descarga HD a resolución natural: foto + overlay 3D (o 2D si es fallback).
    try {
      const img = photoImgRef.current;
      const lm = lastPhotoLmRef.current;
      const nat = photoNatRef.current;
      const t = tryRef.current;
      if (img && lm && nat && t.frame) {
        const full = document.createElement("canvas");
        full.width = nat.W; full.height = nat.H;
        const fctx = full.getContext("2d");
        fctx.drawImage(img, 0, 0, nat.W, nat.H);
        const overlay = threePhotoRef.current;
        const is3D = !!(overlay && arPhotoRef.current && overlay.width > 10);
        if (t.use3D && is3D) {
          // Re-render 3D a tamaño natural y compone (preserveDrawingBuffer permite drawImage)
          const prevW = overlay.width, prevH = overlay.height;
          try {
            arPhotoRef.current.setModel(t.frame, t.tint, t.metrics);
            arPhotoRef.current.render(lm, nat.W, nat.H);
            fctx.drawImage(overlay, 0, 0, nat.W, nat.H);
          } finally {
            arPhotoRef.current.render(lm, prevW, prevH);
          }
        } else {
          drawGlasses(fctx, lm, nat.W, nat.H, nat.W, nat.H, t.forma, undefined, { frame: t.frame, metrics: t.metrics, alpha: 1, light: 0.5, tint: t.tint });
        }
        const a = document.createElement("a");
        a.href = full.toDataURL("image/jpeg", 0.95);
        a.download = `glassescanner-HD-${tryId || "montura"}.jpg`;
        a.click();
        return;
      }
    } catch { /* fallback abajo */ }
    const cnv = photoCanvasRef.current;
    if (!cnv) return;
    const a = document.createElement("a");
    a.href = cnv.toDataURL("image/jpeg", 0.92);
    a.download = `glassescanner-${tryId || "montura"}.jpg`;
    a.click();
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
        modo3D: !!arPhotoRef.current && arOk === true,
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
            <canvas ref={threeLiveRef} className="scanner__overlay" aria-hidden="true" />
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
            <canvas ref={threePhotoRef} className="scanner__overlay" aria-hidden="true" />
          </div>
          <canvas ref={glbCanvasRef} className="scanner__preview" style={{ display: glb3d ? undefined : "none" }} aria-label="Vista 3D fotorrealista" />
          {photoWarn && <p className="scanner__warning">⚠ {photoWarn}</p>}
          {fitInfo && (
            <small className="scanner__sub">
              Montaje {fitInfo.mode3D ? "3D" : "2D"}: IPD {fitInfo.ipdPx}px · ángulo {fitInfo.angDeg}°
              {fitInfo.lensW ? ` · lente ${fitInfo.lensW}×${fitInfo.lensH}px` : ""}
              {` · escala marco ${fitInfo.fitScale}×`}
              {fitInfo.yaw != null ? ` · giro ${fitInfo.yaw}°` : ""}
              {metrics ? ` · sien-sien ${metrics.temporal_est}mm` : " · analizá para ajuste milimétrico"}
              {fitInfo.decent && (fitInfo.decent.ok
                ? ` · pupilas centradas ✓ (A+D ${fitInfo.decent.framePD}mm vs IPD ${metrics?.ipd_mm_est ?? "?"}mm)`
                : ` · ⚠ pupila descentrada ${fitInfo.decent.perEye}mm por ojo`)}
            </small>
          )}
          {(() => {
            const selRec = recs.find((r) => r.frame_id === tryId) ?? null;
            const selScore = selRec?.score ?? null;
            const lenses = lensCompatibility(tryFrame, selScore);
            return tryFrame ? (
              <div className="scanner__trydetail">
                <div className="scanner__trydetail-top">
                  <b>Probando: {tryFrame.nombre}</b>
                  <span className="tag">{tryFrame.forma}</span>
                  <span className="tag">{tryFrame.material} · {tryFrame.color}</span>
                  {selRec && (
                    <span className={`badge-verdict verdict-badge--${selRec.verdict}`}>
                      {selRec.verdict === "compatible" ? "✓" : selRec.verdict === "parcial" ? "~" : "✕"} {selRec.score}pts · {selRec.verdict}
                    </span>
                  )}
                </div>
                <small className="scanner__sub">
                  A {tryFrame.A_mm}mm · B {tryFrame.B_mm}mm · D {tryFrame.D_mm}mm · Total {tryFrame.ancho_total_mm}mm
                  {selRec ? " · puesto #"+(recs.findIndex((r) => r.frame_id === tryId)+1)+" de "+recs.length+" recomendados" : metrics ? " · fuera del top: ver lista" : " · analizá para ver su probabilidad"}
                </small>
                {lenses.length > 0 && (
                  <div className="scanner__lentes">
                    <small><b>Lentes para este rostro + montura (clic para ver el tinte):</b></small>
                    <div className="lentes-tags">
                      {lenses.map((l) => (
                        <button
                          key={l.tipo}
                          type="button"
                          title={`${l.motivo} Clic para montar este lente.`}
                          onClick={() => setTryLens(l.tipo)}
                          className={`lente-tag lente--${l.estado} ${tryLens === l.tipo ? "lente--active" : ""}`}
                        >
                          {l.estado === "compatible" ? "✓" : l.estado === "parcial" ? "~" : "✕"} {l.tipo} {l.prob}%
                        </button>
                      ))}
                    </div>
                    <small className="scanner__sub">Cristal montado: <LenteDot tipo={tryLens} /> <b>{tryLens}</b> — cambia con el modelo o un clic arriba</small>
                  </div>
                )}
              </div>
            ) : null;
          })()}
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
            <button className="btn btn--primary" onClick={runAnalysis} disabled={!!loading}>
              {loading || "Analizar compatibilidad"}
            </button>
            <button className="btn btn--glass" onClick={downloadMontage} disabled={!fitInfo} title="Descarga en resolución original">
              ⬇ Guardar HD
            </button>
            <button className="btn btn--glass" onClick={downloadEvidence} disabled={!fitInfo} title="Descarga foto + JSON con pose y medidas para diagnosticar">
              🧾 Evidencia
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

                <div className="scanner__card-img-wrap">
                  <img
                    src={f?.imagen_url || `/frames/${f?.forma || "rectangular"}.jpg`}
                    alt={f?.nombre || "Montura"}
                    className="scanner__card-img"
                    loading="lazy"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
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

                {(() => {
                  const lenses = lensCompatibility(f, r.score);
                  return lenses.length > 0 ? (
                    <div className="scanner__card-lentes">
                      <small>Lentes para tu rostro en esta montura:</small>
                      <div className="lentes-tags">
                        {lenses.map((l) => (
                          <button key={l.tipo} type="button" title={`${l.motivo} Clic para montar este modelo + lente.`} onClick={() => { setTryId(r.frame_id); setTryLens(l.tipo); setTryOn(true); if (photoCanvasRef.current) photoCanvasRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); }} className={`lente-tag lente--${l.estado}`}>
                            {l.estado === "compatible" ? "✓" : l.estado === "parcial" ? "~" : "✕"} {l.tipo} {l.prob}%
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

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

      <p className="scanner__sub">Probador procedural v2 (8 formas + ajuste por A/B/D y temporal_est). v1.1: modelos GLB fotorrealistas en <code>public/glasses/*.glb</code> con Three.js sobre este mismo veredicto.</p>
    </div>
  );
}
