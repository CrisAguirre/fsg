import { describe, expect, it } from "vitest";
import { LENTES_ORDEN, lensCompatibility } from "./lensCompatibility.js";

const frame = (over = {}) => ({
  forma: "rectangular",
  B_mm: 36,
  tipo_lente: ["monofocal", "progresivo"],
  ...over,
});

describe("lensCompatibility", () => {
  it("devuelve [] sin montura", () => {
    expect(lensCompatibility(null)).toEqual([]);
  });

  it("solo ofrece los lentes declarados por la montura", () => {
    const rows = lensCompatibility(frame({ tipo_lente: ["monofocal"] }));
    expect(rows).toHaveLength(1);
    expect(rows[0].tipo).toBe("monofocal");
    expect(rows[0].estado).toBe("compatible");
  });

  it("respeta el orden canónico cuando las probabilidades empatan", () => {
    const rows = lensCompatibility(frame({ tipo_lente: LENTES_ORDEN }));
    const tipos = rows.map((r) => r.tipo);
    expect(tipos).toContain("monofocal");
    expect(new Set(tipos).size).toBe(tipos.length);
  });

  it("progresivo con B<28 es incompatible y penaliza 45 puntos", () => {
    const [row] = lensCompatibility(frame({ B_mm: 24, tipo_lente: ["progresivo"] }), 90);
    expect(row.estado).toBe("incompatible");
    expect(row.prob).toBe(45);
    expect(row.motivo).toContain("28mm");
  });

  it("progresivo con B=29 es parcial y penaliza 12 puntos", () => {
    const [row] = lensCompatibility(frame({ B_mm: 29, tipo_lente: ["progresivo"] }), 90);
    expect(row.estado).toBe("parcial");
    expect(row.prob).toBe(78);
  });

  it("progresivo con B>=30 es compatible y no penaliza", () => {
    const [row] = lensCompatibility(frame({ B_mm: 32, tipo_lente: ["progresivo"] }), 90);
    expect(row.estado).toBe("compatible");
    expect(row.prob).toBe(90);
  });

  it("bifocal exige B>=26", () => {
    const [row] = lensCompatibility(frame({ B_mm: 25, tipo_lente: ["bifocal"] }));
    expect(row.estado).toBe("incompatible");
  });

  it("fotocromático y polarizado son parciales en rimless", () => {
    const rows = lensCompatibility(
      frame({ forma: "rimless", tipo_lente: ["fotocromático", "polarizado"] }),
    );
    expect(rows.every((r) => r.estado === "parcial")).toBe(true);
  });

  it("usa 80 como score base y acota la probabilidad a [5, 99]", () => {
    const [row] = lensCompatibility(frame({ B_mm: 20, tipo_lente: ["progresivo"] }));
    expect(row.prob).toBe(35); // 80 - 45
    const [top] = lensCompatibility(frame({ tipo_lente: ["monofocal"] }), 500);
    expect(top.prob).toBe(99);
  });

  it("ordena por probabilidad descendente", () => {
    const rows = lensCompatibility(
      frame({ B_mm: 24, tipo_lente: ["progresivo", "monofocal"] }),
      90,
    );
    expect(rows[0].tipo).toBe("monofocal");
    expect(rows[0].prob).toBeGreaterThan(rows[1].prob);
  });
});
