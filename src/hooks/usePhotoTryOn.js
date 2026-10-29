// Try-on sobre foto capturada/subida (MediaPipe IMAGE + recorte 2D + GLB 3D).
// Encapsula el canvas de foto, el landmarker de imagen, el renderer 3D, la
// descarga HD y la liberación de recursos al borrar la foto o desmontar.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  drawGlasses,
  measureGlasses,
  pupilDecentration,
} from "../components/tryon/GlassesOverlay.js";
import { drawPhotoTryOn } from "../components/tryon/PhotoTryOn.js";
import { loadGlassesAR } from "../components/tryon/arLoader.js";
import { sampleBrightness } from "../lib/imageUtils.js";

export function usePhotoTryOn({
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
}) {
  const photoCanvasRef = useRef(null);
  const photoImgRef = useRef(null);
  const threePhotoRef = useRef(null);
  const imgLandmarkerRef = useRef(null);
  const arPhotoRef = useRef(null);
  const lastPhotoLmRef = useRef(null);
  const lastMatrixRef = useRef(null);
  const photoNatRef = useRef(null);
  const [fitInfo, setFitInfo] = useState(null);
  const [photoWarn, setPhotoWarn] = useState("");

  // Try-on en foto capturada/subida (IMAGE mode, reutiliza el mismo CDN).
  useEffect(() => {
    if (!preview) return;
    let dead = false;
    (async () => {
      setPhotoWarn("");
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        if (!imgLandmarkerRef.current) {
          const fileset = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
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
            outputFacialTransformationMatrixes: true,
          });
        }
        const img = photoImgRef.current;
        const cnv = photoCanvasRef.current;
        if (!img || !cnv) return;
        const arCanvas = threePhotoRef.current;
        if (arPhotoRef.current && arCanvas && arPhotoRef.current.canvas !== arCanvas) {
          try {
            arPhotoRef.current.dispose?.();
          } catch {
            /* noop */
          }
          arPhotoRef.current = null;
        }
        await new Promise((r) => {
          if (img.complete && img.naturalWidth) return r();
          img.onload = () => r();
          img.onerror = () => r();
        });
        if (dead) return;
        const W = img.naturalWidth;
        const H = img.naturalHeight;
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
          setFitInfo(null);
          lastPhotoLmRef.current = null;
          try {
            arPhotoRef.current?.clear();
          } catch {
            /* noop */
          }
          return;
        }
        const res = imgLandmarkerRef.current.detect(img);
        const lm = res?.faceLandmarks?.[0];
        if (!lm) {
          setFitInfo(null);
          try {
            arPhotoRef.current?.clear();
          } catch {
            /* noop */
          }
          setPhotoWarn(
            "No se detectó rostro en esta foto. Usa foto frontal, con buena luz, sin gafas oscuras.",
          );
          return;
        }
        const t = tryRef.current;
        // Prioridad 3D: geometría, pose y profundidad reales del GLB. El
        // recorte 2D queda como respaldo si el GLB no carga o no hay WebGL.
        const matrix = res?.facialTransformationMatrixes?.[0]?.data ?? null;
        lastMatrixRef.current = matrix;
        const meas = measureGlasses(lm, cnv.width, cnv.height);
        let drew3D = false;
        let pose3D = null;
        let drewPhoto = false;
        let fit = null;
        if (t.use3D && t.frame && arCanvas) {
          try {
            const GlassesAR = await loadGlassesAR();
            if (dead) return;
            if (!arPhotoRef.current) arPhotoRef.current = new GlassesAR(arCanvas);
            const ar = arPhotoRef.current;
            ar.setModel(t.frame, t.tint, t.metrics);
            await ar.whenReady(1400);
            if (dead) return;
            pose3D = ar.render(lm, cnv.width, cnv.height, matrix ? { matrix } : null);
            drew3D = !!pose3D;
          } catch {
            drew3D = false;
          }
        }
        if (!drew3D) {
          try {
            fit = await drawPhotoTryOn(ctx, lm, cnv.width, cnv.height, t.frame, t.metrics, {
              alpha: t.alpha,
              tint: t.tint,
              light,
            });
            drewPhoto = !!fit;
          } catch {
            drewPhoto = false;
          }
        }
        setArOk((prev) => (prev === drew3D ? prev : drew3D));
        if (!drew3D) {
          // Sin 3D el canvas WebGL no debe conservar el render anterior.
          try {
            arPhotoRef.current?.clear();
          } catch {
            /* noop */
          }
          if (!drewPhoto) {
            fit = drawGlasses(ctx, lm, W, H, cnv.width, cnv.height, t.forma, undefined, {
              frame: t.frame,
              metrics: t.metrics,
              alpha: t.alpha,
              light,
              tint: t.tint,
            });
          }
        }
        if (!dead) {
          lastPhotoLmRef.current = lm;
          if (drewPhoto && fit) {
            setFitInfo({
              ipdPx: Math.round(fit.ipdPx),
              angDeg: Number(fit.angDeg.toFixed(1)),
              fitScale: 1,
              warnings: fit.warnings,
              lensW: Math.round(fit.frameW),
              lensH: Math.round(fit.frameH),
              light: Number(light.toFixed(2)),
              decent: fit.decent ?? null,
              mode3D: false,
              modePhoto: true,
              assetKey: fit.assetKey,
            });
            if (fit.warnings?.length) setPhotoWarn(fit.warnings.join(" · "));
          } else if (drew3D && meas) {
            const decent = pupilDecentration(t.frame, t.metrics);
            let fitScale = 1;
            if (t.frame?.ancho_total_mm && t.metrics?.temporal_est) {
              fitScale = Math.min(
                1.25,
                Math.max(0.85, t.frame.ancho_total_mm / t.metrics.temporal_est),
              );
            }
            setFitInfo({
              ipdPx: Math.round(meas.ipdPx),
              angDeg: Number(meas.angDeg.toFixed(1)),
              fitScale: Number(fitScale.toFixed(2)),
              warnings: meas.warnings,
              lensW: null,
              lensH: null,
              light: Number(light.toFixed(2)),
              decent: decent ?? null,
              mode3D: true,
              modeGlb: !!pose3D?.glb,
              modePhoto: false,
              yaw: pose3D ? Number(pose3D.yawDeg.toFixed(0)) : null,
            });
            if (meas.warnings?.length) setPhotoWarn(meas.warnings.join(" · "));
          } else {
            setFitInfo(
              fit
                ? {
                    ipdPx: Math.round(fit.ipdPx),
                    angDeg: Number(fit.angDeg.toFixed(1)),
                    fitScale: Number(fit.fitScale.toFixed(2)),
                    warnings: fit.warnings,
                    lensW: Math.round(fit.lensW),
                    lensH: Math.round(fit.lensH),
                    light: Number(light.toFixed(2)),
                    decent: fit.decent ?? null,
                    mode3D: false,
                    modePhoto: false,
                  }
                : null,
            );
            if (fit?.warnings?.length) setPhotoWarn(fit.warnings.join(" · "));
          }
        }
      } catch {
        /* foto sin try-on sigue permitiendo análisis */
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, tryId, tryOn, metrics, tryOpacity, tryLens, showOriginal, frames]);

  // El canvas 3D de la foto se desmonta con la página: liberar su contexto WebGL.
  useEffect(() => {
    return () => {
      try {
        arPhotoRef.current?.dispose?.();
      } catch {
        /* noop */
      }
      arPhotoRef.current = null;
      try {
        imgLandmarkerRef.current?.close?.();
      } catch {
        /* noop */
      }
      imgLandmarkerRef.current = null;
    };
  }, []);

  const resetPhotoTryOn = useCallback(() => {
    lastPhotoLmRef.current = null;
    try {
      arPhotoRef.current?.clear();
      arPhotoRef.current?.dispose?.();
    } catch {
      /* noop */
    }
    arPhotoRef.current = null;
    setFitInfo(null);
    setPhotoWarn("");
  }, []);

  const downloadHD = useCallback(async () => {
    // Descarga HD a resolución natural con la misma prioridad:
    // 1. Recorte 2D real (PhotoTryOn).
    // 2. Armazón 3D procedural si está habilitado.
    // 3. Dibujo vectorial 2D como aproximación final.
    try {
      const img = photoImgRef.current;
      const lm = lastPhotoLmRef.current;
      const nat = photoNatRef.current;
      const t = tryRef.current;
      if (img && lm && nat && t.frame) {
        const full = document.createElement("canvas");
        full.width = nat.W;
        full.height = nat.H;
        const fctx = full.getContext("2d");
        fctx.drawImage(img, 0, 0, nat.W, nat.H);

        // Misma prioridad que en pantalla: 3D primero, 2D como respaldo.
        let drew3D = false;
        const overlay = threePhotoRef.current;
        if (t.use3D && overlay && arPhotoRef.current) {
          const prevW = overlay.width;
          const prevH = overlay.height;
          // Límite de textura WebGL: fotos muy grandes se renderizan a escala
          // y se componen al tamaño natural.
          const hd = Math.min(1, 4096 / Math.max(nat.W, nat.H));
          const rw = Math.max(2, Math.round(nat.W * hd));
          const rh = Math.max(2, Math.round(nat.H * hd));
          const matrix = lastMatrixRef.current;
          try {
            arPhotoRef.current.setModel(t.frame, t.tint, t.metrics);
            const pose = arPhotoRef.current.render(lm, rw, rh, matrix ? { matrix } : null);
            if (pose) {
              fctx.drawImage(overlay, 0, 0, nat.W, nat.H);
              drew3D = true;
            }
          } catch {
            drew3D = false;
          } finally {
            try {
              arPhotoRef.current.render(lm, prevW, prevH, matrix ? { matrix } : null);
            } catch {
              /* noop */
            }
          }
        }

        if (!drew3D) {
          let drewPhoto = false;
          try {
            const fitPhoto = await drawPhotoTryOn(fctx, lm, nat.W, nat.H, t.frame, t.metrics, {
              alpha: 1,
              tint: t.tint,
              light: 0.5,
            });
            drewPhoto = !!fitPhoto;
          } catch {
            drewPhoto = false;
          }
          if (!drewPhoto) {
            drawGlasses(fctx, lm, nat.W, nat.H, nat.W, nat.H, t.forma, undefined, {
              frame: t.frame,
              metrics: t.metrics,
              alpha: 1,
              light: 0.5,
              tint: t.tint,
            });
          }
        }
        const a = document.createElement("a");
        a.href = full.toDataURL("image/jpeg", 0.95);
        a.download = `glassescanner-HD-${tryId || "montura"}.jpg`;
        a.click();
        return;
      }
    } catch {
      /* fallback abajo */
    }
    const cnv = photoCanvasRef.current;
    if (!cnv) return;
    const a = document.createElement("a");
    a.href = cnv.toDataURL("image/jpeg", 0.92);
    a.download = `glassescanner-${tryId || "montura"}.jpg`;
    a.click();
  }, [tryId, tryRef]);

  return {
    photoCanvasRef,
    photoImgRef,
    threePhotoRef,
    fitInfo,
    photoWarn,
    downloadHD,
    resetPhotoTryOn,
  };
}
