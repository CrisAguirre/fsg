import { describe, expect, it } from "vitest";
import { pickTopFrames } from "./tryOnSnapshot.js";

const FRAMES = [
  { id: "F01", nombre: "Uno" },
  { id: "F02", nombre: "Dos" },
  { id: "F03", nombre: "Tres" },
];

describe("pickTopFrames", () => {
  it("ordena por score y devuelve las dos mejores monturas del catálogo", () => {
    const recs = [
      { frame_id: "F02", score: 61 },
      { frame_id: "F01", score: 88 },
      { frame_id: "F03", score: 74 },
    ];
    const picked = pickTopFrames(recs, FRAMES);
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

  it("respeta el límite y tolera listas vacías", () => {
    expect(pickTopFrames([], FRAMES)).toEqual([]);
    expect(pickTopFrames(null, null)).toEqual([]);
    expect(pickTopFrames([{ frame_id: "F01", score: 88 }], FRAMES, 1)).toHaveLength(1);
  });
});
