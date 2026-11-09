import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./pwa.js";

describe("registro del service worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no registra el service worker fuera de producción", () => {
    const register = vi.fn();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      location: { reload: vi.fn() },
    });
    vi.stubGlobal("navigator", {
      serviceWorker: { register, addEventListener: vi.fn(), controller: null },
    });
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });
});
