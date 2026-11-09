// En desarrollo se pasa por el proxy de Vite (/api -> backend remoto) para que
// el navegador no bloquee las llamadas por CORS. En producción se usa la URL
// absoluta configurada en `.env`.
const API_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_DEV || "/api"
  : import.meta.env.VITE_API_URL || "http://localhost:8000";

// Red inestable / Render en frío: los GET se reintentan con espera corta.
// Las mutaciones no se reintentan solas (evita duplicar análisis o feedback).
const GET_TIMEOUT_MS = 12000;
const MUTATION_TIMEOUT_MS = 20000;
const ANALYZE_TIMEOUT_MS = 45000;
const RETRY_DELAYS_MS = [500, 1500];

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Petición JSON con timeout. Los GET reintentan ante red caída, timeout o 5xx;
 * las mutaciones fallan rápido para no duplicar efectos en el backend.
 * @param {string} path
 * @param {RequestInit} opts
 * @param {{timeoutMs?: number, retries?: number}} [config]
 */
async function req(path, opts = {}, { timeoutMs, retries = 0 } = {}) {
  const method = String(opts.method || "GET").toUpperCase();
  const maxRetries = method === "GET" ? retries : 0;
  const effectiveTimeout = timeoutMs ?? (method === "GET" ? GET_TIMEOUT_MS : MUTATION_TIMEOUT_MS);
  let attempt = 0;
  for (;;) {
    try {
      const r = await fetchWithTimeout(`${API_URL}${path}`, opts, effectiveTimeout);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        /** @type {Error & {status?: number}} */
        const error = new Error(`API ${r.status}: ${t.slice(0, 200)}`);
        error.status = r.status;
        if (attempt < maxRetries && isRetryableStatus(r.status)) {
          await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
          attempt += 1;
          continue;
        }
        throw error;
      }
      return r.json();
    } catch (error) {
      // Sin status = red caída, timeout o respuesta no-JSON: se puede reintentar.
      const retryable = !(error && typeof error === "object" && "status" in error);
      if (attempt < maxRetries && retryable) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
}

export const health = () => req("/health", {}, { retries: 1 });

// Último catálogo bueno en localStorage: si Render está en frío o la red falla,
// la app sigue mostrando monturas en vez de quedarse vacía.
const FRAMES_CACHE_KEY = "gpv.frames.v1";

function readFramesCache(optica_id) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(FRAMES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if ((parsed?.optica_id ?? null) !== (optica_id ?? null)) return null;
    return Array.isArray(parsed?.frames) && parsed.frames.length > 0 ? parsed.frames : null;
  } catch {
    return null;
  }
}

function writeFramesCache(optica_id, frames) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      FRAMES_CACHE_KEY,
      JSON.stringify({ optica_id: optica_id ?? null, frames, savedAt: Date.now() }),
    );
  } catch {
    // Storage lleno, modo privado o bloqueado: no es fatal.
  }
}

export async function listFrames(optica_id = null) {
  const qs = optica_id ? `?optica_id=${encodeURIComponent(optica_id)}` : "";
  try {
    const frames = await req(`/frames${qs}`, {}, { retries: 1 });
    if (Array.isArray(frames) && frames.length > 0) writeFramesCache(optica_id, frames);
    return frames;
  } catch (error) {
    const cached = readFramesCache(optica_id);
    if (cached) return cached;
    throw error;
  }
}

export async function analyzePhoto(fileOrBlob) {
  const fd = new FormData();
  fd.append("photo", fileOrBlob, "rostro.jpg");
  const r = await fetchWithTimeout(
    `${API_URL}/analyze`,
    { method: "POST", body: fd },
    ANALYZE_TIMEOUT_MS,
  );
  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    throw new Error(`analyze ${r.status}: ${errText.slice(0, 200)}`);
  }
  return r.json();
}

export const deletePhoto = () => req("/analyze/photo", { method: "DELETE" });

export const recommend = (metrics, frame_ids = null, optica_id = null) =>
  req("/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics, frame_ids, optica_id }),
  });

export const sendFeedback = (data) =>
  req("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const getFeedbackStats = () => req("/feedback/stats", {}, { retries: 1 });

export const createFrame = (frame, adminKey) =>
  req("/frames", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
    body: JSON.stringify(frame),
  });

export const updateFrame = (id, frame, adminKey) =>
  req(`/frames/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
    body: JSON.stringify(frame),
  });

export const deleteFrame = (id, adminKey) =>
  req(`/frames/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-Admin-Key": adminKey },
  });

export const seedFrames = (adminKey) =>
  req("/frames/seed", {
    method: "POST",
    headers: { "X-Admin-Key": adminKey },
  });

export { API_URL };

