import { describe, expect, it } from "vitest";
import { eyeAnchors, FACE_IDX } from "./landmarks.js";

const N = 478;
const IRIS_A = [468, 469, 470, 471, 472];
const IRIS_B = [473, 474, 475, 476, 477];

const mk = (n = N) => Array.from({ length: n }, () => ({ x: 0.5, y: 0.5, z: 0 }));
const set = (lm, i, x, y) => { lm[i] = { x, y, z: 0 }; };
const fill = (lm, ids, x, y) => { for (const i of ids) set(lm, i, x, y); };

// Rostro simétrico de 200x100 px: ojos a 20 px de cada centro.
const face = (n = N) => {
  const lm = mk(n);
  set(lm, FACE_IDX.leftOuter, 0.2, 0.4);
  set(lm, FACE_IDX.leftInner, 0.4, 0.4);
  set(lm, FACE_IDX.rightInner, 0.6, 0.4);
  set(lm, FACE_IDX.rightOuter, 0.8, 0.4);
  set(lm, FACE_IDX.nose, 0.5, 0.5);
  return lm;
};

describe("eyeAnchors", () => {
  it("devuelve null sin landmarks o con tamaño inválido", () => {
    expect(eyeAnchors(null, 200, 100)).toBeNull();
    expect(eyeAnchors(mk(100), 200, 100)).toBeNull();
    expect(eyeAnchors(face(), 0, 100)).toBeNull();
    expect(eyeAnchors(face(), 200, 0)).toBeNull();
  });

  it("devuelve null si falta una esquina ocular", () => {
    const lm = face();
    lm[FACE_IDX.rightOuter] = null;
    expect(eyeAnchors(lm, 200, 100)).toBeNull();
  });

  it("sin iris (malla de 468) usa el punto medio de las esquinas", () => {
    const a = eyeAnchors(face(468), 200, 100);
    expect(a).not.toBeNull();
    expect(a.source).toBe("corner");
    expect(a.lc.x).toBeCloseTo(60, 6);
    expect(a.rc.x).toBeCloseTo(140, 6);
    expect(a.ipdPx).toBeCloseTo(80, 6);
    expect(a.cornerIpdPx).toBeCloseTo(80, 6);
    expect(a.ang).toBeCloseTo(0, 6);
    expect(a.irisL).toBeNull();
    expect(a.irisR).toBeNull();
  });

  it("ignora iris degenerados (placeholder en el mismo punto)", () => {
    // face() deja los 10 puntos de iris en (0.5, 0.5): misma posición.
    const a = eyeAnchors(face(), 200, 100);
    expect(a.source).toBe("corner");
    expect(a.ipdPx).toBeCloseTo(80, 6);
    expect(a.irisL).toBeNull();
  });

  it("prioriza los centros de iris cuando son utilizables", () => {
    const lm = face();
    fill(lm, IRIS_A, 0.35, 0.4);
    fill(lm, IRIS_B, 0.65, 0.4);
    const a = eyeAnchors(lm, 200, 100);
    expect(a.source).toBe("iris");
    expect(a.lc.x).toBeCloseTo(70, 6);
    expect(a.rc.x).toBeCloseTo(130, 6);
    expect(a.ipdPx).toBeCloseTo(60, 6);
    // Las esquinas siguen disponibles para diagnóstico.
    expect(a.cornerIpdPx).toBeCloseTo(80, 6);
    expect(a.irisL).toEqual(a.lc);
    expect(a.irisR).toEqual(a.rc);
  });

  it("ordena los iris por x de imagen, no por convención del modelo", () => {
    const lm = face();
    fill(lm, IRIS_A, 0.65, 0.4); // grupo A a la derecha de la imagen
    fill(lm, IRIS_B, 0.35, 0.4); // grupo B a la izquierda
    const a = eyeAnchors(lm, 200, 100);
    expect(a.source).toBe("iris");
    expect(a.lc.x).toBeCloseTo(70, 6);
    expect(a.rc.x).toBeCloseTo(130, 6);
    expect(a.irisL.x).toBeCloseTo(70, 6);
    expect(a.irisR.x).toBeCloseTo(130, 6);
  });

  it("calcula el roll con los iris y conserva el de las esquinas", () => {
    const lm = face();
    fill(lm, IRIS_A, 0.35, 0.42);
    fill(lm, IRIS_B, 0.65, 0.38);
    const a = eyeAnchors(lm, 200, 100);
    expect(a.source).toBe("iris");
    expect(a.lc.y).toBeCloseTo(42, 6);
    expect(a.rc.y).toBeCloseTo(38, 6);
    expect(a.ang).toBeCloseTo(Math.atan2(-4, 60), 6);
    expect(a.cornerAng).toBeCloseTo(0, 6);
    expect(a.ipdPx).toBeCloseTo(Math.hypot(60, -4), 6);
  });

  it("expone el puente nasal en píxeles", () => {
    const lm = face();
    set(lm, FACE_IDX.nose, 0.5, 0.55);
    const a = eyeAnchors(lm, 200, 100);
    expect(a.bridge.x).toBeCloseTo(100, 6);
    expect(a.bridge.y).toBeCloseTo(55, 6);
    expect(a.nose).toEqual({ x: 0.5, y: 0.55, z: 0 });
  });
});
