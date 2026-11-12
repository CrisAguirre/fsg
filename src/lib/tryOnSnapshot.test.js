import { describe, expect, it } from "vitest";
import { pickDiverseFrames, rankFrames } from "./frameRanking.js";
import { pickTopFrames } from "./tryOnSnapshot.js";

const FRAMES = [
  { id: "F01", nombre: "Uno" },
  { id: "F02", nombre: "Dos" },
  { id: "F03", nombre: "Tres" },
];

const RECS = [
  { frame_id: "F02", score: 61 },
  { frame_id: "F01", score: 88 },
  { frame_id: "F03", score: 74 },
];

describe("rankFrames", () => {
  it("ordena por score y descarta lo que no está en el catálogo", () => {
    const ranked = rankFrames([...RECS, { frame_id: "F99", score: 99 }], FRAMES);
    expect(ranked.map((p) => p.frame.id)).toEqual(["F01", "F03", "F02"]);
    expect(ranked.map((p) => p.rec.score)).toEqual([88, 74, 61]);
  });

  it("deduplica por id y respeta el límite", () => {
    const ranked = rankFrames(
      [...RECS, { frame_id: "F01", score: 88 }],
      FRAMES,
      2,
    );
    expect(ranked.map((p) => p.frame.id)).toEqual(["F01", "F03"]);
    expect(rankFrames([], FRAMES)).toEqual([]);
    expect(rankFrames(null, null)).toEqual([]);
    expect(rankFrames(RECS, FRAMES, 0)).toEqual([]);
  });
});

describe("pickTopFrames", () => {
  it("ordena por score y devuelve las dos mejores monturas del catálogo", () => {
    const picked = pickTopFrames(RECS, FRAMES);
    expect(picked.map((p) => p.frame.id)).toEqual(["F01", "F03"]);
    expect(picked.map((p) => p.rec.score)).toEqual([88, 74]);
  });

  it("descarta recomendaciones que no existen en el catálogo", () => {
    const recs = [
      { frame_id: "F99", score: 99 },
      { frame_id: "F02", score: 61 },
    ];
    const picked = pickTopFrames(recs, FRAMES);
    expect(picked).toHaveLength(1);
    expect(picked[0].frame.id).toBe("F02");
  });

  it("no repite una montura aunque llegue duplicada", () => {
    const recs = [
      { frame_id: "F01", score: 88 },
      { frame_id: "F01", score: 88 },
      { frame_id: "F02", score: 61 },
    ];
    const picked = pickTopFrames(recs, FRAMES);
    expect(picked.map((p) => p.frame.id)).toEqual(["F01", "F02"]);
  });

  it("prioriza una forma distinta cuando las dos mejores comparten forma", () => {
    const frames = [
      { id: "F01", forma: "rectangular" },
      { id: "F02", forma: "rectangular" },
      { id: "F03", forma: "redondo" },
    ];
    const recs = [
      { frame_id: "F01", score: 92 },
      { frame_id: "F02", score: 90 },
      { frame_id: "F03", score: 71 },
    ];
    const picked = pickTopFrames(recs, frames);
    expect(picked.map((p) => p.frame.id)).toEqual(["F01", "F03"]);
  });

  it("completa por score si no hay una segunda forma disponible", () => {
    const frames = [
      { id: "F01", forma: "rectangular" },
      { id: "F02", forma: "rectangular" },
      { id: "F03", forma: "rectangular" },
    ];
    const recs = [
      { frame_id: "F01", score: 92 },
      { frame_id: "F02", score: 90 },
      { frame_id: "F03", score: 71 },
    ];
    const picked = pickTopFrames(recs, frames);
    expect(picked.map((p) => p.frame.id)).toEqual(["F01", "F02"]);
  });

  it("con 8 formas distintas y límite 10 devuelve 10 sin repetir", () => {
    const shapes = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const frames = Array.from({ length: 10 }, (_, i) => ({
      id: `F${i + 1}`,
      forma: shapes[i % shapes.length],
    }));
    const recs = frames.map((frame, i) => ({ frame_id: frame.id, score: 100 - i }));
    const picked = pickTopFrames(recs, frames, 10);
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((p) => p.frame.id)).size).toBe(10);
    // Las 8 primeras cubren las 8 formas; las 2 restantes completan por score.
    expect(picked.slice(0, 8).map((p) => p.frame.forma)).toEqual(shapes);
    expect(picked.slice(8).map((p) => p.frame.id)).toEqual(["F9", "F10"]);
  });

  it("respeta el límite y tolera listas vacías", () => {
    expect(pickTopFrames([], FRAMES)).toEqual([]);
    expect(pickTopFrames(null, null)).toEqual([]);
    expect(pickTopFrames([{ frame_id: "F01", score: 88 }], FRAMES, 1)).toHaveLength(1);
  });
});

describe("pickDiverseFrames", () => {
  it("mantiene el orden de score cuando no hay forma declarada", () => {
    const picked = pickDiverseFrames(RECS, FRAMES);
    expect(picked.map((p) => p.frame.id)).toEqual(["F01", "F03"]);
  });
});
