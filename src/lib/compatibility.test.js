import { describe, expect, it } from "vitest";
import {
  attrPercentages,
  centering,
  fitAssessment,
  lensPercentages,
  ratioInsights,
} from "./compatibility.js";

const FRAMES = [
  {
    id: "F01",
    forma: "rectangular",
    material: "Acetato",
    color: "Negro",
    A_mm: 52,
    B_mm: 36,
    D_mm: 18,
    tipo_lente: ["monofocal", "blue-cut"],
  },
  {
    id: "F02",
    forma: "redondo",
    material: "Metal",
    color: "Dorado",
    A_mm: 48,
    B_mm: 42,
    D_mm: 20,
    tipo_lente: ["polarizado"],
  },
  {
    id: "F03",
    forma: "rectangular",
    material: "Metal",
    color: "Negro",
    A_mm: 50,
    B_mm: 38,
    D_mm: 18,
    tipo_lente: ["monofocal"],
  },
];

const RECS = [
  { frame_id: "F01", score: 90, verdict: "compatible" },
  { frame_id: "F02", score: 60, verdict: "parcial" },
  { frame_id: "F03", score: 80, verdict: "compatible" },
];

describe("attrPercentages", () => {
  it("promedia el score por forma y ordena de mayor a menor", () => {
    const rows = attrPercentages(RECS, FRAMES, "forma");
    expect(rows[0]).toMatchObject({ valor: "rectangular", pct: 85, n: 2 });
    expect(rows[1]).toMatchObject({ valor: "redondo", pct: 60, n: 1 });
  });

  it("agrupa material y color sin inventar valores", () => {
    expect(attrPercentages(RECS, FRAMES, "material").map((r) => r.valor)).toEqual([
      "Acetato",
      "Metal",
    ]);
    expect(attrPercentages(RECS, FRAMES, "color")[0]).toMatchObject({ valor: "Negro", pct: 85 });
  });

  it("ignora recomendaciones de monturas fuera del catálogo", () => {
    const rows = attrPercentages([{ frame_id: "X9", score: 99 }], FRAMES, "forma");
    expect(rows).toEqual([]);
  });
});

describe("lensPercentages", () => {
  it("calcula la probabilidad media por tipo de lente", () => {
    const rows = lensPercentages(RECS, FRAMES);
    const tipos = rows.map((r) => r.valor);
    expect(tipos).toContain("monofocal");
    expect(tipos).toContain("polarizado");
    expect(rows.every((r) => r.pct > 0 && r.pct <= 100)).toBe(true);
    expect(rows).toEqual([...rows].sort((a, b) => b.pct - a.pct));
  });
});

describe("centering", () => {
  it("marca centrado cuando la PD de la montura se acerca a la IPD", () => {
    const c = centering({ ipd_mm_est: 63 }, { id: "F", A_mm: 52, D_mm: 18 });
    expect(c.framePD).toBe(70);
    expect(c.dif).toBe(7);
    expect(c.estado).toBe("aceptable");
  });

  it("marca descentrado con más de 8 mm de diferencia", () => {
    expect(centering({ ipd_mm_est: 58 }, { id: "F", A_mm: 54, D_mm: 20 }).estado).toBe("descentrado");
  });

  it("sin IPD no inventa estado", () => {
    expect(centering({}, { id: "F", A_mm: 52, D_mm: 18 }).estado).toBe("sin datos");
  });
});

describe("fitAssessment", () => {
  it("descuenta ajuste cuando el centrado es descentrado", () => {
    const frame = { id: "F", A_mm: 56, D_mm: 20 };
    const a = fitAssessment({ ipd_mm_est: 60 }, frame, { frame_id: "F", score: 90, verdict: "compatible", reasons: [] });
    expect(a.overall).toBe(82);
    expect(a.verdict).toBe("compatible");
  });

  it("mantiene el score si el centrado es correcto", () => {
    const frame = { id: "F", A_mm: 45, D_mm: 18 };
    const a = fitAssessment({ ipd_mm_est: 63 }, frame, { frame_id: "F", score: 90 });
    expect(a.overall).toBe(90);
  });
});

describe("ratioInsights", () => {
  it("describe las tres proporciones con su lectura", () => {
    const rows = ratioInsights({
      ratios: { largo_ancho: 1.3, frente_pomulo: 1.1, mandibula_frente: 0.9 },
    });
    expect(rows).toHaveLength(3);
    expect(rows[1].texto).toMatch(/Frente más ancha/);
  });
});
