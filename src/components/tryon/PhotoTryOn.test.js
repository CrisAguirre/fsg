import { describe, expect, it } from "vitest";
import { hasFrontalPhotoAsset } from "./PhotoTryOn.js";

describe("hasFrontalPhotoAsset", () => {
  it("acepta las dos formas con recorte frontal", () => {
    expect(hasFrontalPhotoAsset({ forma: "rectangular" })).toBe(true);
    expect(hasFrontalPhotoAsset({ forma: "rimless" })).toBe(true);
  });

  it("rechaza las formas recortadas en 3/4", () => {
    for (const forma of ["aviador", "cat-eye", "cuadrado", "oval", "redondo", "wayfarer"]) {
      expect(hasFrontalPhotoAsset({ forma })).toBe(false);
    }
  });

  it("normaliza mayúsculas y acepta tryon_key", () => {
    expect(hasFrontalPhotoAsset({ forma: "Rectangular" })).toBe(true);
    expect(hasFrontalPhotoAsset({ tryon_key: "rimless" })).toBe(true);
    expect(hasFrontalPhotoAsset({ forma: "Cuadrado" })).toBe(false);
  });

  it("sin montura no hay asset frontal", () => {
    expect(hasFrontalPhotoAsset(null)).toBe(false);
    expect(hasFrontalPhotoAsset({})).toBe(false);
  });
});
