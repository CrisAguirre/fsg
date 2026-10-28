// En desarrollo se pasa por el proxy de Vite (/api -> backend remoto) para que
// el navegador no bloquee las llamadas por CORS. En producción se usa la URL
// absoluta configurada en `.env`.
const API_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_URL_DEV || "/api"
  : import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(path, opts = {}) {
  const r = await fetch(`${API_URL}${path}`, opts);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

export const health = () => req("/health");
export const listFrames = (optica_id = null) => {
  const qs = optica_id ? `?optica_id=${encodeURIComponent(optica_id)}` : "";
  return req(`/frames${qs}`);
};

export async function analyzePhoto(fileOrBlob) {
  const fd = new FormData();
  fd.append("photo", fileOrBlob, "rostro.jpg");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(`${API_URL}/analyze`, { method: "POST", body: fd, signal: ctrl.signal });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      throw new Error(`analyze ${r.status}: ${errText.slice(0, 200)}`);
    }
    return r.json();
  } finally {
    clearTimeout(t);
  }
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

export const getFeedbackStats = () => req("/feedback/stats");

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

