import { describe, expect, it } from "vitest";
import installed from "../../node_modules/@mediapipe/tasks-vision/package.json";
import {
  MEDIAPIPE_MODEL_URL,
  MEDIAPIPE_VERSION,
  MEDIAPIPE_WASM_URL,
} from "./mediapipeConfig.js";

describe("mediapipeConfig", () => {
  it("usa la misma versión que el paquete instalado", () => {
    expect(MEDIAPIPE_VERSION).toBe(installed.version);
    expect(MEDIAPIPE_WASM_URL).toContain(
      `@mediapipe/tasks-vision@${installed.version}/wasm`,
    );
  });

  it("apunta al modelo oficial de rostro float16", () => {
    expect(MEDIAPIPE_MODEL_URL).toContain("face_landmarker");
    expect(MEDIAPIPE_MODEL_URL).toContain("float16");
  });
});
