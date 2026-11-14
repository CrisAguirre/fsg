import { describe, expect, it } from "vitest";
import {
  LENS_COLORS,
  NEUTRAL_LENS,
  lensGradient,
  lensPreset,
  lensRgba,
  lensStyleKey,
  mixLensColor,
  normalizeLensStyle,
  shadeLensColor,
} from "./lensStyle.js";

describe("lensPreset", () => {
  it("fija los tres controles para cada tipo de lente", () => {
    const clear = lensPreset("monofocal");
    expect(clear).toEqual({ color: "#cfe0f0", intensity: 0.3, opacity: 0.18 });

    const sun = lensPreset("polarizado");
    expect(sun).toEqual({ color: "#232f38", intensity: 1, opacity: 0.65 });
    expect(lensPreset("fotocromático").opacity).toBeLessThan(sun.opacity);
    expect(lensPreset("blue-cut").color).toBe("#d9a93f");
    expect(lensPreset("progresivo").opacity).toBeGreaterThan(0);
  });

  it("cae en el preset limpio para tipos desconocidos", () => {
    expect(lensPreset("otro")).toEqual(lensPreset("monofocal"));
    expect(lensPreset()).toEqual(lensPreset("monofocal"));
  });

  it("devuelve copias para no mutar el preset compartido", () => {
    const a = lensPreset("polarizado");
    a.opacity = 0.1;
    expect(lensPreset("polarizado").opacity).toBe(0.65);
  });
});

describe("normalizeLensStyle", () => {
  it("conserva un estilo válido", () => {
    expect(normalizeLensStyle({ color: "#123456", intensity: 0.4, opacity: 0.3 })).toEqual({
      color: "#123456",
      intensity: 0.4,
      opacity: 0.3,
    });
  });

  it("usa el preset del tipo para valores ausentes o inválidos", () => {
    const base = lensPreset("polarizado");
    expect(normalizeLensStyle(null, "polarizado")).toEqual(base);
    expect(normalizeLensStyle({ color: "rojo", intensity: "x", opacity: -1 }, "polarizado")).toEqual({
      ...base,
      opacity: 0.02,
    });
  });

  it("acota intensidad y opacidad al rango del motor", () => {
    expect(normalizeLensStyle({ intensity: 5, opacity: 9 }).intensity).toBe(1);
    expect(normalizeLensStyle({ intensity: 5, opacity: 9 }).opacity).toBe(0.95);
    expect(normalizeLensStyle({ intensity: -3, opacity: 0 }).intensity).toBe(0);
    expect(normalizeLensStyle({ intensity: -3, opacity: 0 }).opacity).toBe(0.02);
  });
});

describe("mixLensColor", () => {
  it("va del cristal neutro al color puro según la intensidad", () => {
    expect(mixLensColor("#000000", 0)).toBe(NEUTRAL_LENS);
    expect(mixLensColor("#000000", 1)).toBe("#000000");
    expect(mixLensColor("#ffffff", 0.5)).toBe("#f9fbff");
  });

  it("tolera colores inválidos y valores fuera de rango", () => {
    expect(mixLensColor("no-es-color", 1)).toBe(NEUTRAL_LENS);
    expect(mixLensColor("#000000", 4)).toBe("#000000");
    expect(mixLensColor("#000000", -1)).toBe(NEUTRAL_LENS);
  });
});

describe("shadeLensColor y lensRgba", () => {
  it("aclara y oscurece sin salirse de 0–255", () => {
    expect(shadeLensColor("#808080", 20)).toBe("#949494");
    expect(shadeLensColor("#ffffff", 50)).toBe("#ffffff");
    expect(shadeLensColor("#000000", -50)).toBe("#000000");
  });

  it("compone rgba con alfa acotado", () => {
    expect(lensRgba("#102030", 0.5)).toBe("rgba(16,32,48,0.500)");
    expect(lensRgba("#102030", 4)).toBe("rgba(16,32,48,1.000)");
  });
});

describe("lensGradient", () => {
  it("respeta la opacidad configurada", () => {
    const low = lensGradient({ color: "#4b5563", intensity: 1, opacity: 0.1 }, 1);
    const high = lensGradient({ color: "#4b5563", intensity: 1, opacity: 0.9 }, 1);
    const alpha = (s) => Number(s.match(/,([0-9.]+)\)$/)[1]);
    expect(alpha(high.mid)).toBeGreaterThan(alpha(low.mid));
  });

  it("aplica el tinte del tipo cuando no hay estilo", () => {
    const sun = lensGradient(null, 0.5, "polarizado");
    const clear = lensGradient(null, 0.5, "monofocal");
    expect(sun.mid).not.toBe(clear.mid);
    expect(sun.mid).toMatch(/^rgba\(\d+,\d+,\d+,[0-9.]+\)$/);
  });
});

describe("lensStyleKey", () => {
  it("cambia con color, intensidad u opacidad", () => {
    const base = lensStyleKey({ color: "#111111", intensity: 0.5, opacity: 0.4 });
    expect(lensStyleKey({ color: "#222222", intensity: 0.5, opacity: 0.4 })).not.toBe(base);
    expect(lensStyleKey({ color: "#111111", intensity: 0.6, opacity: 0.4 })).not.toBe(base);
    expect(lensStyleKey({ color: "#111111", intensity: 0.5, opacity: 0.5 })).not.toBe(base);
    expect(lensStyleKey({ color: "#111111", intensity: 0.5, opacity: 0.4 })).toBe(base);
  });
});

describe("LENS_COLORS", () => {
  it("ofrece una paleta de 8 tonos hex válidos", () => {
    expect(LENS_COLORS).toHaveLength(8);
    for (const c of LENS_COLORS) {
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});
