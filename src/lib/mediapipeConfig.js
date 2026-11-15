// Configuración única de MediaPipe Tasks-Vision.
// El bundle JS (@mediapipe/tasks-vision) y los archivos WASM deben ser de la
// misma versión. Si se actualiza la dependencia en package.json, actualizar
// también MEDIAPIPE_VERSION; mediapipeConfig.test.js lo verifica.
export const MEDIAPIPE_VERSION = "1.0.1";

export const MEDIAPIPE_WASM_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

export const MEDIAPIPE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
