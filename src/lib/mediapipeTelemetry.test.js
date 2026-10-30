import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMediapipeTelemetry,
  blockMediapipeTelemetry,
} from "./mediapipeTelemetry.js";

describe("blockMediapipeTelemetry", () => {
  let realFetch;

  beforeEach(() => {
    realFetch = vi.fn(() => Promise.resolve(new Response("real")));
    vi.stubGlobal("window", {
      fetch: realFetch,
      location: { href: "https://grupoprismavision.vercel.app/" },
    });
    __resetMediapipeTelemetry();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetMediapipeTelemetry();
  });

  it("corta la telemetría de MediaPipe sin abrir la conexión", async () => {
    blockMediapipeTelemetry();
    const res = await window.fetch("https://odml.pa.googleapis.com/v1/log", {
      method: "POST",
      body: "x",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("deja pasar el resto de peticiones al fetch real", async () => {
    blockMediapipeTelemetry();
    await window.fetch("https://glassescanner-backend.onrender.com/frames");
    await window.fetch("/glasses/manifest.json");
    expect(realFetch).toHaveBeenCalledTimes(2);
  });

  it("se instala una sola vez", () => {
    blockMediapipeTelemetry();
    const once = window.fetch;
    blockMediapipeTelemetry();
    expect(window.fetch).toBe(once);
  });
});
