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
import { normalizeLensStyle } from "../components/tryon/lensStyle.js";
import { loadGlassesAR } from "../components/tryon/arLoader.js";
import { closeImageLandmarker, getImageLandmarker } from "../lib/faceLandmarker.js";
import { sampleBrightness } from "../lib/imageUtils.js";

export function usePhotoTryOn({
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
  closeOnUnmount = false,
}) {
  const photoCanvasRef = useRef(null);
  const photoImgRef = useRef(null);
  const threePhotoRef = useRef(null);
  const arPhotoRef = useRef(null);
  const lastPhotoLmRef = useRef(null);
  const lastMatrixRef = useRef(null);
  const lastLightRef = useRef(0.5);
  const lastModeRef = useRef("2d");
  const lensDrawRef = useRef(0);
  const photoNatRef = useRef(null);
  // El estilo de lente se lee por ref dentro del efecto principal para no
  // volver a ejecutar MediaPipe en cada tick de los sliders.
  const lensStyleRef = useRef(lensStyle);
  useEffect(() => {
    lensStyleRef.current = lensStyle;
  }, [lensStyle]);
  const [fitInfo, setFitInfo] = useState(null);
  const [photoWarn, setPhotoWarn] = useState("");

  // Try-on en foto capturada/subida (IMAGE mode, reutiliza el mismo CDN).
  useEffect(() => {
    if (!preview) return;
    let dead = false;
    // Estado del probador derivado de las props (no del ref): los efectos del
    // hijo corren antes que el del padre que actualiza `tryRef`, y un toggle
    // 2D/3D se quedaría un render atrás.
    const frame = (frames ?? []).find((f) => f.id === tryId) ?? (frames ?? [])[0] ?? null;
    const t = {
      on: tryOn && !showOriginal,
      forma: frame?.forma ?? "rectangular",
      frame,
      metrics,
      alpha: tryOpacity,
      tint: tryLens,
      lensStyle: lensStyleRef.current,
      use3D,
    };
    (async () => {
      setPhotoWarn("");
      try {
        const landmarker = await getImageLandmarker();
        if (dead) return;
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
        await /** @type {Promise<void>} */ (new Promise((r) => {
          if (img.complete && img.naturalWidth) return r();
          img.onload = () => r();
          img.onerror = () => r();
        }));
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
        lastLightRef.current = light;
        if (!t.on) {
          setFitInfo(null);
          lastPhotoLmRef.current = null;
          try {
            arPhotoRef.current?.clear();
          } catch {
            /* noop */
          }
          return;
        }
        const res = landmarker.detect(img);
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
        // Prioridad 3D: geometría, pose y profundidad reales del GLB. El
        // recorte 2D queda como respaldo si el GLB no carga o no hay WebGL.
        const matrix = res?.facialTransformationMatrixes?.[0]?.data ?? null;
        lastMatrixRef.current = matrix;
        const meas = measureGlasses(lm, cnv.width, cnv.height);
        let drew3D = false;
        let pose3D = null;
        let drewPhoto = false;
        let fit = null;
        if (t.use3D && t.frame && t.frame.forma !== "rimless" && arCanvas) {
          try {
            const GlassesAR = await loadGlassesAR();
            if (dead) return;
            if (!arPhotoRef.current) arPhotoRef.current = new GlassesAR(arCanvas);
            const ar = arPhotoRef.current;
            ar.clipBack = true;
            ar.setModel(t.frame, t.tint, t.metrics);
            ar.setLensStyle(lensStyleRef.current, t.tint);
            await ar.whenReady(1400);
            if (dead) return;
            // El estilo pudo cambiar mientras cargaba el GLB.
            ar.setLensStyle(lensStyleRef.current, t.tint);
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
              lensStyle: lensStyleRef.current,
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
              lensStyle: lensStyleRef.current,
            });
          }
        }
        if (!dead) {
          lastPhotoLmRef.current = lm;
          lastModeRef.current = drew3D ? "3d" : "2d";
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
  }, [preview, tryId, tryOn, metrics, tryOpacity, tryLens, showOriginal, frames, use3D]);

  // Cambios de lente en caliente: el 3D muta los materiales del grupo actual y
  // re-renderiza con la pose cacheada; el 2D/vectorial recompone la foto con los
  // landmarks cacheados. No vuelve a ejecutar MediaPipe por cada tick.
  useEffect(() => {
    const lm = lastPhotoLmRef.current;
    const cnv = photoCanvasRef.current;
    if (!lm || !cnv || !tryRef.current?.on) return;
    const frame = (frames ?? []).find((f) => f.id === tryId) ?? (frames ?? [])[0] ?? null;
    if (!frame) return;
    const style = normalizeLensStyle(lensStyle, tryLens);
    const ar = arPhotoRef.current;
    if (use3D && lastModeRef.current === "3d" && frame.forma !== "rimless" && ar && threePhotoRef.current) {
      try {
        ar.setLensStyle(style, tryLens);
        ar.render(lm, cnv.width, cnv.height, lastMatrixRef.current ? { matrix: lastMatrixRef.current } : null);
        return;
      } catch {
        /* cae al redibujo 2D */
      }
    }
    const img = photoImgRef.current;
    if (!img) return;
    const token = ++lensDrawRef.current;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
    const light = lastLightRef.current;
    const metricsNow = tryRef.current.metrics ?? null;
    const alphaNow = tryRef.current.alpha ?? 1;
    drawPhotoTryOn(ctx, lm, cnv.width, cnv.height, frame, metricsNow, {
      alpha: alphaNow,
      tint: tryLens,
      lensStyle: style,
      light,
    })
      .then((fit) => {
        if (token !== lensDrawRef.current) return;
        if (fit) return;
        drawGlasses(ctx, lm, cnv.width, cnv.height, cnv.width, cnv.height, frame.forma ?? "rectangular", undefined, {
          frame,
          metrics: metricsNow,
          alpha: alphaNow,
          light,
          tint: tryLens,
          lensStyle: style,
        });
      })
      .catch(() => {
        /* conserva la foto base */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lensStyle, tryLens]);

  // El canvas 3D de la foto se desmonta con la página: liberar su contexto WebGL.
  useEffect(() => {
    return () => {
      try {
        arPhotoRef.current?.dispose?.();
      } catch {
        /* noop */
      }
      arPhotoRef.current = null;
      // El landmarker es compartido con el informe: solo la página que lo
      // posee lo libera, no cada consumidor que se desmonta.
      if (closeOnUnmount) closeImageLandmarker();
    };
  }, [closeOnUnmount]);

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
        if (t.use3D && t.frame?.forma !== "rimless" && overlay && arPhotoRef.current) {
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
            arPhotoRef.current.setLensStyle(t.lensStyle, t.tint);
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
              lensStyle: t.lensStyle,
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
              lensStyle: t.lensStyle,
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
