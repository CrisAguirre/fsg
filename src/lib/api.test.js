import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzePhoto, health, listFrames, recommend, resetBackendWake, wakeBackend } from "./api.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("api resiliente", () => {
  let fetchMock;

  const makeStorage = () => {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
      clear: () => map.clear(),
    };
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    resetBackendWake();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetBackendWake();
  });

  it("health valida r.ok y no acepta un 404", async () => {
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));
    await expect(health()).rejects.toThrow(/API 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("health reintenta un 5xx y termina bien", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(json({ ok: true }));
    await expect(health()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("listFrames reintenta un fallo de red", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json([{ id: "F01" }]));
    await expect(listFrames()).resolves.toEqual([{ id: "F01" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("listFrames cae al catálogo cacheado si la red sigue caída", async () => {
    vi.stubGlobal("localStorage", makeStorage());
    fetchMock.mockResolvedValueOnce(json([{ id: "F01" }]));
    await expect(listFrames()).resolves.toEqual([{ id: "F01" }]);

    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(listFrames()).resolves.toEqual([{ id: "F01" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("no usa el caché de otra óptica", async () => {
    vi.stubGlobal("localStorage", makeStorage());
    fetchMock.mockResolvedValueOnce(json([{ id: "F01" }]));
    await listFrames("optica-a");

    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(listFrames("optica-b")).rejects.toThrow(/Failed to fetch/);
  });

  it("no reintenta mutaciones para no duplicar efectos", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(recommend({}, null, null)).rejects.toThrow(/API 500/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("analyzePhoto falla rápido ante un 4xx", async () => {
    fetchMock.mockResolvedValue(new Response("bad", { status: 400 }));
    await expect(analyzePhoto(new Blob(["x"]))).rejects.toThrow(/analyze 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("wakeBackend", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    resetBackendWake();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetBackendWake();
  });

  it("comparte una sola petición entre llamadas concurrentes", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await Promise.all([wakeBackend(), wakeBackend(), wakeBackend()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recuerda el backend despierto durante unos minutos", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await wakeBackend();
    await expect(wakeBackend()).resolves.toMatchObject({ cached: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("vuelve a despertar cuando expira la caché de 5 minutos", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    fetchMock.mockImplementation(() => Promise.resolve(json({ ok: true })));

    await wakeBackend();
    now.mockReturnValue(1_000_000 + 5 * 60 * 1000 + 1);
    await wakeBackend();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("libera la promesa si falla para permitir reintentar", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json({ ok: true }));

    await expect(wakeBackend()).rejects.toThrow(/Failed to fetch/);
    await expect(wakeBackend()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
