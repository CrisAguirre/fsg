import { describe, expect, it } from "vitest";
import { measureGlasses, pupilDecentration, smoothLandmarks } from "./GlassesOverlay.js";

const N = 478;
const mk = () => Array.from({ length: N }, () => ({ x: 0.5, y: 0.5, z: 0 }));
const set = (lm, i, x, y) => { lm[i] = { x, y, z: 0 }; };

// Rostro simétrico de 200x100 px: ojos a 20 px de cada centro.
const face = () => {
  const lm = mk();
  set(lm, 33, 0.2, 0.4); set(lm, 133, 0.4, 0.4);
  set(lm, 362, 0.6, 0.4); set(lm, 263, 0.8, 0.4);
  set(lm, 168, 0.5, 0.5);
  return lm;
};

describe("measureGlasses", () => {
  it("devuelve null con landmarks insuficientes", () => {
    expect(measureGlasses(null, 200, 100)).toBeNull();
    expect(measureGlasses(new Array(100), 200, 100)).toBeNull();
  });

  it("calcula IPD, ancho de ojo y asimetría en píxeles", () => {
    const m = measureGlasses(face(), 200, 100);
    expect(m.ipdPx).toBeCloseTo(80, 6); // (0.7 - 0.3) * 200
    expect(m.eyeW).toBeCloseTo(40, 6); // (0.4 - 0.2) * 200
    expect(m.asym).toBeCloseTo(0, 6);
    expect(m.angDeg).toBeCloseTo(0, 6);
    expect(m.warnings).toEqual([]);
  });

  it("avisa si el rostro está rotado más de 15°", () => {
    const lm = face();
    set(lm, 362, 0.6, 0.1); set(lm, 263, 0.8, 0.1);
    const m = measureGlasses(lm, 200, 100);
    expect(m.angDeg).toBeGreaterThan(15);
    expect(m.warnings.join(" ")).toMatch(/rotado/i);
  });

  it("avisa si el rostro está muy lejos", () => {
    const lm = face();
    set(lm, 33, 0.48, 0.4); set(lm, 133, 0.49, 0.4);
    set(lm, 362, 0.51, 0.4); set(lm, 263, 0.52, 0.4);
    const m = measureGlasses(lm, 200, 100);
    expect(m.ipdPx).toBeLessThan(200 * 0.08);
    expect(m.warnings.join(" ")).toMatch(/lejos/i);
  });

  it("usa los centros de iris cuando la malla los trae", () => {
    const lm = face();
    for (const i of [468, 469, 470, 471, 472]) set(lm, i, 0.35, 0.4);
    for (const i of [473, 474, 475, 476, 477]) set(lm, i, 0.65, 0.4);
    const m = measureGlasses(lm, 200, 100);
    expect(m.anchor).toBe("iris");
    expect(m.lc.x).toBeCloseTo(70, 6);
    expect(m.lc.y).toBeCloseTo(40, 6);
    expect(m.rc.x).toBeCloseTo(130, 6);
    expect(m.rc.y).toBeCloseTo(40, 6);
    expect(m.ipdPx).toBeCloseTo(60, 6);
    expect(m.cornerIpdPx).toBeCloseTo(80, 6);
    expect(m.angDeg).toBeCloseTo(0, 6);
    expect(m.bridge.x).toBeCloseTo(100, 6);
    expect(m.bridge.y).toBeCloseTo(50, 6);
    expect(m.warnings).toEqual([]);
  });

  it("cae a las esquinas si los iris son placeholder", () => {
    // face() deja los iris en (0.5, 0.5): IPD de iris nula → fallback.
    const m = measureGlasses(face(), 200, 100);
    expect(m.anchor).toBe("corner");
    expect(m.ipdPx).toBeCloseTo(80, 6);
    expect(m.irisL).toBeNull();
    expect(m.irisR).toBeNull();
  });
});

describe("pupilDecentration", () => {
  it("devuelve null sin medidas", () => {
    expect(pupilDecentration(null, null)).toBeNull();
    expect(pupilDecentration({ A_mm: 52 }, { ipd_mm_est: 63 })).toBeNull();
  });

  it("calcula la diferencia entre A+D y la IPD", () => {
    const d = pupilDecentration({ A_mm: 52, D_mm: 18 }, { ipd_mm_est: 63 });
    expect(d).not.toBeNull();
    expect(d.diff).toBeCloseTo(7, 6);
  });
});

describe("smoothLandmarks", () => {
  it("sin frame previo devuelve el actual", () => {
    const curr = face();
    expect(smoothLandmarks(null, curr)).toBe(curr);
  });

  it("interpola con el alfa indicado", () => {
    const prev = [{ x: 0, y: 0, z: 0 }];
    const curr = [{ x: 1, y: 1, z: 1 }];
    const out = smoothLandmarks(prev, curr, 0.25);
    expect(out[0]).toEqual({ x: 0.25, y: 0.25, z: 0.25 });
  });

  it("si cambia el número de puntos no interpola", () => {
    const curr = face();
    expect(smoothLandmarks([{ x: 0, y: 0, z: 0 }], curr)).toBe(curr);
  });
});
