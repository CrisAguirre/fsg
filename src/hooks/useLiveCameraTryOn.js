// Cámara en vivo + landmarks MediaPipe + try-on 3D/2D.
// Encapsula el ciclo requestAnimationFrame, las sesiones cancelables y la
// liberación de la cámara/WebGL. `Frame3D` se importa dinámicamente para que
// Three.js no entre en el chunk inicial del escáner.

import { useCallback, useEffect, useRef, useState } from "react";
import { drawGlasses, smoothLandmarks } from "../components/tryon/GlassesOverlay.js";
import { loadGlassesAR } from "../components/tryon/arLoader.js";

let glassesARClass = null;

/**
 * @param {{ tryRef: { current: object }, onError?: (msg: string) => void }} options
 */
export function useLiveCameraTryOn({ tryRef, onError }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const threeLiveRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const liveSessionRef = useRef(0);
  const cameraSessionRef = useRef(0);
  const smoothLmRef = useRef(null);
  const rafRef = useRef(0);
  const arLiveRef = useRef(null);
  const [livePts, setLivePts] = useState(0);
  const [arOk, setArOk] = useState(null);

  const stopCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    liveSessionRef.current += 1;
    cancelAnimationFrame(rafRef.current);
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    smoothLmRef.current = null;
    try {
      arLiveRef.current?.clear();
      arLiveRef.current?.dispose?.();
    } catch {
      /* noop */
    }
    arLiveRef.current = null;
  }, []);

  const startLiveLandmarks = useCallback(async () => {
    const session = liveSessionRef.current + 1;
    liveSessionRef.current = session;
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    );
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    // Si se detuvo la cámara o se inició otra sesión mientras cargaba el CDN,
    // cerrar este modelo y no arrancar un loop huérfano.
    if (session !== liveSessionRef.current || !streamRef.current) {
      landmarker.close?.();
      return;
    }
    landmarkerRef.current = landmarker;

    const loop = async () => {
      if (session !== liveSessionRef.current) return;
      const v = videoRef.current;
      const cnv = overlayRef.current;
      if (v && cnv && v.videoWidth) {
        // Usar resolución real del video (no clientWidth) para no deformar el montaje.
        // El CSS (.scanner__overlay 100%) se encarga del escalado visual.
        cnv.width = v.videoWidth;
        cnv.height = v.videoHeight;
        try {
          const res = landmarker.detectForVideo(v, performance.now());
          const pts = res?.faceLandmarks?.[0]?.length ?? 0;
          setLivePts(pts);
          const ctx = cnv.getContext("2d");
          ctx.clearRect(0, 0, cnv.width, cnv.height);
          if (pts > 0) {
            const raw = res.faceLandmarks[0];
            const lm = smoothLandmarks(smoothLmRef.current, raw, 0.55);
            smoothLmRef.current = lm;
            const t = tryRef.current;
            // El 3D vive en su propio canvas; el 2D queda como fallback.
            if (t.on) {
              let drew3D = false;
              if (t.use3D && t.frame) {
                // Primer frame tras habilitar 3D: se dispara la carga y se sigue
                // mostrando el fallback 2D hasta que el chunk esté disponible.
                if (!glassesARClass) {
                  loadGlassesAR()
                    .then((Cls) => {
                      glassesARClass = Cls;
                    })
                    .catch(() => {});
                } else {
                  try {
                    // Si React recreó el canvas, el renderer anterior queda obsoleto.
                    if (arLiveRef.current && arLiveRef.current.canvas !== threeLiveRef.current) {
                      arLiveRef.current.dispose?.();
                      arLiveRef.current = null;
                    }
                    if (!arLiveRef.current && threeLiveRef.current) {
                      arLiveRef.current = new glassesARClass(threeLiveRef.current);
                    }
                    const ar = arLiveRef.current;
                    if (ar) {
                      ar.setModel(t.frame, t.tint, t.metrics);
                      const pose = ar.render(lm, cnv.width, cnv.height);
                      drew3D = !!pose;
                    }
                  } catch {
                    drew3D = false;
                  }
                }
              }
              setArOk((prev) => (prev === drew3D ? prev : drew3D));
              if (!drew3D) {
                try {
                  arLiveRef.current?.clear();
                } catch {
                  /* noop */
                }
                drawGlasses(ctx, lm, v.videoWidth, v.videoHeight, cnv.width, cnv.height, t.forma, undefined, {
                  frame: t.frame,
                  metrics: t.metrics,
                  alpha: t.alpha,
                  light: 0.55,
                  tint: t.tint,
                });
              }
            } else {
              // Sin probador: limpiar también el canvas 3D para no dejar un armazón fantasma.
              try {
                arLiveRef.current?.clear();
              } catch {
                /* noop */
              }
              ctx.fillStyle = "rgba(0,212,255,.8)";
              const sx = cnv.width / v.videoWidth;
              const sy = cnv.height / v.videoHeight;
              for (let i = 0; i < lm.length; i += 6) {
                ctx.beginPath();
                ctx.arc(lm[i].x * v.videoWidth * sx, lm[i].y * v.videoHeight * sy, 1.6, 0, 7);
                ctx.fill();
              }
            }
          } else {
            try {
              arLiveRef.current?.clear();
            } catch {
              /* noop */
            }
          }
        } catch {
          /* un frame fallido no rompe el loop */
        }
      }
      if (session === liveSessionRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    cancelAnimationFrame(rafRef.current);
    loop();
  }, [tryRef]);

  const startCamera = useCallback(async () => {
    onError?.("");
    stopCamera();
    const session = cameraSessionRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      // Si mientras se pedía permiso se cambió de pestaña o se reintentó,
      // detener este stream huérfano.
      if (session !== cameraSessionRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
      if (session !== cameraSessionRef.current) return;
      // Overlay landmarks en vivo (progresivo, no bloquea si falla la red/CDN).
      startLiveLandmarks().catch(() => {});
    } catch {
      if (session !== cameraSessionRef.current) return;
      onError?.("No se pudo abrir la cámara (permiso, HTTPS o sin cámara). Usa la pestaña Subir foto.");
    }
  }, [onError, startLiveLandmarks, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    videoRef,
    overlayRef,
    threeLiveRef,
    livePts,
    arOk,
    setArOk,
    startCamera,
    stopCamera,
  };
}
