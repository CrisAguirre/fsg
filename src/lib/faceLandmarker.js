// Landmarker de MediaPipe para imágenes (foto subida o capturada).
// Singleton compartido por el probador 2D y el informe: crear una instancia por
// consumidor duplica el modelo en memoria y puede fallar en móviles con poca RAM.
// La telemetría de MediaPipe se corta antes de cargar el CDN (privacidad).
import { blockMediapipeTelemetry } from "./mediapipeTelemetry.js";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise = null;

function create(fileset, FaceLandmarker, delegate) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "IMAGE",
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
  });
}

/**
 * Devuelve el landmarker de imagen, creándolo una sola vez.
 * Intenta GPU y cae a CPU si el dispositivo no tiene WebGL disponible.
 * @returns {Promise<import("@mediapipe/tasks-vision").FaceLandmarker>}
 */
export function getImageLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      blockMediapipeTelemetry();
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      try {
        return await create(fileset, FaceLandmarker, "GPU");
      } catch {
        return create(fileset, FaceLandmarker, "CPU");
      }
    })().catch((err) => {
      // Si falla la descarga del CDN, permitir reintentar en la próxima llamada.
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/** Libera el modelo compartido (al desmontar el escáner). */
export function closeImageLandmarker() {
  const pending = landmarkerPromise;
  landmarkerPromise = null;
  pending
    ?.then((landmarker) => {
      try {
        landmarker?.close?.();
      } catch {
        /* noop */
      }
    })
    .catch(() => {});
}
