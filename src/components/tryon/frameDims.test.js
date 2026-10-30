import { describe, expect, it } from "vitest";
import { frameDims } from "./Frame3D.js";

const FRAME = {
  A_mm: 52,
  B_mm: 36,
  D_mm: 18,
  ancho_total_mm: 138,
  forma: "rectangular",
};

describe("frameDims", () => {
  it("usa una IPD estándar antes del análisis para no encoger la montura", () => {
    const dims = frameDims(FRAME, null);
    expect(dims.ipd).toBe(63);
    expect(dims.lensW).toBeCloseTo(52 / 63, 3);
    // Dos lentes + puente ≈ ancho total de la montura (no ~1 IPD).
    expect(2 * dims.lensCX + dims.lensW).toBeGreaterThan(1.7);
  });

  it("respeta la IPD medida cuando ya hay análisis", () => {
    const dims = frameDims(FRAME, { ipd_mm_est: 70 });
    expect(dims.ipd).toBe(70);
    expect(dims.lensW).toBeCloseTo(52 / 70, 3);
  });
});
