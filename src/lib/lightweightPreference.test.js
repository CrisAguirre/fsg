import { beforeEach, describe, expect, it, vi } from "vitest";

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

describe("lightweightPreference", () => {
  beforeEach(() => {
    vi.resetModules();
    delete globalThis.localStorage;
  });

  it("guarda la preferencia en memoria aunque localStorage falle", async () => {
    const mod = await import("./lightweightPreference.js");
    expect(mod.readLightweightPreference()).toBeNull();

    const seen = [];
    const unsubscribe = mod.subscribeLightweight(() =>
      seen.push(mod.readLightweightPreference()),
    );

    mod.writeLightweightPreference(true);
    expect(mod.readLightweightPreference()).toBe(true);
    expect(seen).toEqual([true]);

    unsubscribe();
    mod.writeLightweightPreference(false);
    expect(seen).toEqual([true]);
  });

  it("persiste 1/0 y limpia la clave al volver a automático", async () => {
    const storage = fakeStorage();
    globalThis.localStorage = /** @type {any} */ (storage);
    const mod = await import("./lightweightPreference.js");

    mod.writeLightweightPreference(true);
    expect(storage.getItem("gpv.lightweight")).toBe("1");
    mod.writeLightweightPreference(false);
    expect(storage.getItem("gpv.lightweight")).toBe("0");
    mod.writeLightweightPreference(null);
    expect(storage.getItem("gpv.lightweight")).toBeNull();
  });

  it("lee una preferencia previa de localStorage", async () => {
    const storage = fakeStorage();
    storage.setItem("gpv.lightweight", "1");
    globalThis.localStorage = /** @type {any} */ (storage);
    const mod = await import("./lightweightPreference.js");
    expect(mod.readLightweightPreference()).toBe(true);
  });
});
