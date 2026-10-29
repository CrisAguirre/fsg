import { describe, expect, it } from "vitest";
import { LENS_KIND, LENS_SWATCH, frameColorHex, lensKind } from "./frameStyle.js";

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
