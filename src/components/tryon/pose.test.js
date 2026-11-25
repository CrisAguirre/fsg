import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { estimatePose, poseFromMatrix } from "./Frame3D.js";

const N = 478;
const mk = () => Array.from({ length: N }, () => ({ x: 0.5, y: 0.5, z: 0 }));
const set = (lm, i, x, y, z = 0) => { lm[i] = { x, y, z }; };

const frontal = () => {
  const lm = mk();
  set(lm, 33, 0.35, 0.4); set(lm, 133, 0.45, 0.4);
  set(lm, 362, 0.55, 0.4); set(lm, 263, 0.65, 0.4);
  set(lm, 168, 0.5, 0.5); set(lm, 10, 0.5, 0.15); set(lm, 152, 0.5, 0.8);
  set(lm, 234, 0.28, 0.45); set(lm, 454, 0.72, 0.45);
  return lm;
};

const matrixFor = (euler) => {
  const m = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(euler.x || 0, euler.y || 0, euler.z || 0, "YXZ"),
  );
  // MediaPipe entrega la matriz en orden fila; `toArray()` de Three.js es
  // columna, así que se transpone para probar la misma entrada real.
  return m.transpose().toArray();
};

describe("poseFromMatrix", () => {
  it("rechaza entradas incompletas", () => {
    expect(poseFromMatrix(null)).toBeNull();
    expect(poseFromMatrix([])).toBeNull();
    expect(poseFromMatrix(new Array(15).fill(0))).toBeNull();
  });

  it("la matriz identidad da pose neutra", () => {
    const p = poseFromMatrix(new THREE.Matrix4().identity().toArray());
    expect(p.yaw).toBeCloseTo(0, 6);
    expect(p.pitch).toBeCloseTo(0, 6);
    expect(p.roll).toBeCloseTo(0, 6);
  });

  it("extrae yaw, pitch y roll de una rotación pura", () => {
    expect(poseFromMatrix(matrixFor({ y: 0.3 })).yaw).toBeCloseTo(0.3, 5);
    expect(poseFromMatrix(matrixFor({ x: -0.2 })).pitch).toBeCloseTo(-0.2, 5);
    expect(poseFromMatrix(matrixFor({ z: 0.15 })).roll).toBeCloseTo(0.15, 5);
  });

  it("devuelve null si la matriz no es numérica", () => {
    expect(poseFromMatrix(new Array(16).fill(NaN))).toBeNull();
  });
});

describe("estimatePose (heurístico de respaldo)", () => {
  it("rostro frontal: yaw y roll cercanos a cero", () => {
    const p = estimatePose(frontal());
    expect(Math.abs(p.yaw)).toBeLessThan(0.02);
    expect(Math.abs(p.roll)).toBeLessThan(0.02);
    expect(Math.abs(p.pitch)).toBeLessThan(0.1);
    expect(p.cx).toBeCloseTo(0.5, 9);
    expect(p.ipd).toBeCloseTo(0.2, 9);
  });

  it("giro a la derecha produce yaw negativo", () => {
    const lm = frontal();
    set(lm, 362, 0.56, 0.4); set(lm, 263, 0.62, 0.4);
    expect(estimatePose(lm).yaw).toBeLessThan(-0.05);
  });

  it("conserva la IPD y el roll en píxeles sobre fotos o videos verticales inclinados", () => {
    const lm = frontal();
    // Cabeza inclinada 45° en un frame vertical 720×1280
    set(lm, 33, 0.35, 0.40); set(lm, 133, 0.43, 0.445);
    set(lm, 362, 0.55, 0.5125); set(lm, 263, 0.63, 0.5575);
    const p = estimatePose(lm, 720, 1280);
    const dx = (0.59 - 0.39) * 720;
    const dy = (0.535 - 0.4225) * 1280;
    expect(p.ipd * 720).toBeCloseTo(Math.hypot(dx, dy), 4);
    expect(p.roll).toBeCloseTo(Math.atan2(dy, dx), 5);
  });
});
