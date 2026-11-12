// Montajes 2D para el informe: la foto original y las dos monturas con mejor
// compatibilidad, renderizadas en el cliente. No se suben ni se persisten.
// Usa el mismo motor que el probador (recorte fotorrealista + respaldo vectorial)
// y un único landmarker de imagen para ambas monturas.
import { drawGlasses } from "../components/tryon/GlassesOverlay.js";
import { drawPhotoTryOn } from "../components/tryon/PhotoTryOn.js";
import { getImageLandmarker } from "./faceLandmarker.js";
import { pickDiverseFrames } from "./frameRanking.js";
import { sampleBrightness } from "./imageUtils.js";

const MAX_SIDE = 1000;
const JPEG_QUALITY = 0.9;
const MODEL_TIMEOUT_MS = 20000;

/** Rechaza si la promesa no resuelve a tiempo (CDN lento o colgado). */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const SNAPSHOT_REASON_MESSAGE = {
  "no-photo": "No hay una fotografía disponible para generar los montajes.",
  "no-frames": "No hay monturas recomendadas para generar los montajes.",
  "no-face":
    "No se detectó un rostro claro en la foto, así que no se pudieron generar los montajes.",
  model: "No se pudo cargar el modelo de rostro. Revisa la conexión e inténtalo de nuevo.",
  render: "No se pudieron dibujar los montajes en este dispositivo.",
};

/**
 * Elige las monturas mejor puntuadas que existan en el catálogo, sin repetir y
 * priorizando formas distintas para que los dos montajes del informe no sean
 * dos variantes del mismo tipo. Si no hay formas suficientes, completa por score.
 * @param {Array<{frame_id: string, score: number}>} recs
 * @param {Array<{id: string, forma?: string}>} frames
 * @param {number} limit
 */
export function pickTopFrames(recs, frames, limit = 2) {
  return pickDiverseFrames(recs, frames, limit);
}

function loadPhoto(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Genera un JPEG por montura sobre la foto original.
 * @returns {Promise<{images: Array<object>, reason: string|null}>}
 */
export async function renderTryOnSnapshots({ photoUrl, frames, recs, metrics, limit = 2 }) {
  if (!photoUrl) return { images: [], reason: "no-photo" };
  const picks = pickTopFrames(recs, frames, limit);
  if (picks.length === 0) return { images: [], reason: "no-frames" };

  const img = await loadPhoto(photoUrl);
  if (!img || !img.naturalWidth || !img.naturalHeight) {
    return { images: [], reason: "no-photo" };
  }

  let landmarker;
  try {
    landmarker = await withTimeout(getImageLandmarker(), MODEL_TIMEOUT_MS);
  } catch {
    return { images: [], reason: "model" };
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  // Los landmarks son independientes de la montura: se detectan una sola vez.
  let landmarks = null;
  try {
    landmarks = landmarker.detect(img)?.faceLandmarks?.[0] ?? null;
  } catch {
    return { images: [], reason: "model" };
  }
  if (!landmarks) return { images: [], reason: "no-face" };

  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;
  const baseCtx = base.getContext("2d");
  if (!baseCtx) return { images: [], reason: "render" };
  baseCtx.drawImage(img, 0, 0, width, height);
  const light = sampleBrightness(base);

  const images = [];
  for (const { frame, rec } of picks) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.drawImage(base, 0, 0);

    let drew = false;
    try {
      drew = !!(await drawPhotoTryOn(ctx, landmarks, width, height, frame, metrics, {
        alpha: 1,
        light,
      }));
    } catch {
      drew = false;
    }
    if (!drew) {
      try {
        drew = !!drawGlasses(
          ctx,
          landmarks,
          width,
          height,
          width,
          height,
          frame?.forma ?? "rectangular",
          undefined,
          { frame, metrics, alpha: 1, light },
        );
      } catch {
        drew = false;
      }
    }
    // Si ningún motor pudo dibujar, no se muestra una foto repetida como montaje.
    if (!drew) continue;

    images.push({
      id: frame.id,
      nombre: frame.nombre ?? frame.id,
      score: Number(rec?.score) || 0,
      verdict: rec?.verdict ?? "",
      dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    });
  }

  return { images, reason: images.length > 0 ? null : "render" };
}
