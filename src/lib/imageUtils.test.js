import { describe, expect, it } from "vitest";
import { sampleBrightness } from "./imageUtils.js";

describe("sampleBrightness", () => {
  it("devuelve 0.5 si no hay canvas utilizable (no rompe la UI)", () => {
    expect(sampleBrightness(null)).toBe(0.5);
    expect(sampleBrightness({})).toBe(0.5);
  });
});
