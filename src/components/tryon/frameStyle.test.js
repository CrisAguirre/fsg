import { describe, expect, it } from "vitest";
import {
  FRAME_FINISH,
  LENS_KIND,
  LENS_SWATCH,
  frameColorHex,
  frameFinish,
  frameMaterialProfile,
  isDarkColor,
  lensKind,
} from "./frameStyle.js";

describe("frameColorHex", () => {
  it("mapea los materiales del catálogo a su hex", () => {
    expect(frameColorHex("Dorado")).toBe("#c19a3a");
    expect(frameColorHex("dorado rosa")).toBe("#d8a08a");
    expect(frameColorHex("Carey oscuro")).toBe("#5b2f12");
    expect(frameColorHex("Negro")).toBe("#17171a");
    expect(frameColorHex("Negro mate")).toBe("#26262b"); // 'mate' tiene prioridad
    expect(frameColorHex("Azul marino")).toBe("#1e3a8a");
  });

  it("tolera mayúsculas y acentos del nombre", () => {
    expect(frameColorHex("TITANIO")).toBe("#b8c0cc");
    expect(frameColorHex("Borgoña")).toBe("#6b1a2a");
  });

  it("devuelve el color por defecto si no reconoce el material", () => {
    expect(frameColorHex("")).toBe("#23232a");
    expect(frameColorHex(undefined)).toBe("#23232a");
    expect(frameColorHex("material-inventado")).toBe("#26262b"); // contiene 'mate'
    expect(frameColorHex("sin-acabado")).toBe("#23232a");
  });

  it("acepta un hex directo del manifest", () => {
    expect(frameColorHex("#333A42")).toBe("#333a42");
    expect(frameColorHex("#abc")).toBe("#abc");
  });
});

describe("frameFinish", () => {
  it("clasifica materiales y colores del catálogo", () => {
    expect(frameFinish({ material: "metal", color: "titanio" })).toBe(FRAME_FINISH.METAL);
    expect(frameFinish({ material: "mixto", color: "negro/rojo" })).toBe(FRAME_FINISH.MIXED);
    expect(frameFinish({ material: "acetato", color: "carey" })).toBe(FRAME_FINISH.CAREY);
    expect(frameFinish({ material: "acetato", color: "negro mate" })).toBe(FRAME_FINISH.MATTE);
    expect(frameFinish({ material: "acetato", color: "cristal" })).toBe(FRAME_FINISH.TRANSPARENT);
    expect(frameFinish({ material: "acetato", color: "negro" })).toBe(FRAME_FINISH.ACETATE);
  });

  it("el color de carey/transparente manda sobre el material", () => {
    expect(frameFinish({ material: "metal", color: "carey claro" })).toBe(FRAME_FINISH.CAREY);
    expect(frameFinish({ material: "metal", color: "transparente" })).toBe(FRAME_FINISH.TRANSPARENT);
  });
});

describe("frameMaterialProfile", () => {
  it("da más metalness al metal que al acetato", () => {
    const metal = frameMaterialProfile({ material: "metal", color: "dorado" });
    const acetate = frameMaterialProfile({ material: "acetato", color: "negro" });
    expect(metal.color).toBe("#c19a3a");
    expect(metal.metalness).toBeGreaterThan(0.8);
    expect(acetate.metalness).toBeLessThan(0.1);
    expect(acetate.clearcoat).toBeGreaterThan(0.5);
  });

  it("marca el cristal como transparente y con menos tinte", () => {
    const crystal = frameMaterialProfile({ material: "acetato", color: "cristal" });
    expect(crystal.finish).toBe(FRAME_FINISH.TRANSPARENT);
    expect(crystal.opacity).toBeLessThan(1);
    expect(crystal.tintStrength).toBeLessThan(0.5);
  });
});

describe("isDarkColor", () => {
  it("distingue negros de colores con luminosidad", () => {
    expect(isDarkColor("#17171a")).toBe(true);
    expect(isDarkColor("#000")).toBe(true);
    expect(isDarkColor("#c19a3a")).toBe(false);
    expect(isDarkColor("")).toBe(false);
  });
});

describe("lensKind", () => {
  it("clasifica cada familia de tinte", () => {
    expect(lensKind("polarizado")).toBe(LENS_KIND.SUN);
    expect(lensKind("fotocromático")).toBe(LENS_KIND.PHOTOCHROMIC);
    expect(lensKind("blue-cut")).toBe(LENS_KIND.BLUE);
    expect(lensKind("progresivo")).toBe(LENS_KIND.PROGRESSIVE);
    expect(lensKind("bifocal")).toBe(LENS_KIND.PROGRESSIVE);
    expect(lensKind("monofocal")).toBe(LENS_KIND.CLEAR);
  });

  it("cae en clear para vacío o desconocido", () => {
    expect(lensKind()).toBe(LENS_KIND.CLEAR);
    expect(lensKind("")).toBe(LENS_KIND.CLEAR);
    expect(lensKind("otro")).toBe(LENS_KIND.CLEAR);
  });

  it("no distingue mayúsculas", () => {
    expect(lensKind("POLARIZADO")).toBe(LENS_KIND.SUN);
  });
});

describe("LENS_SWATCH", () => {
  it("cubre todas las familias de tinte", () => {
    expect(Object.keys(LENS_SWATCH).sort()).toEqual(
      ["bifocal", "blue-cut", "fotocromático", "monofocal", "polarizado", "progresivo"].sort(),
    );
  });
});
