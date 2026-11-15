// Landmarker de MediaPipe para imágenes (foto subida o capturada).
// Singleton compartido por el probador 2D y el informe: crear una instancia por
// consumidor duplica el modelo en memoria y puede fallar en móviles con poca RAM.
// La telemetría de MediaPipe se corta antes de cargar el CDN (privacidad).
import { blockMediapipeTelemetry } from "./mediapipeTelemetry.js";
import { MEDIAPIPE_MODEL_URL, MEDIAPIPE_WASM_URL } from "./mediapipeConfig.js";

let landmarkerPromise = null;

function create(fileset, FaceLandmarker, delegate) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_URL, delegate },
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
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
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
