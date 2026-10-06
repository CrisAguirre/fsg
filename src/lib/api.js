const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(path, opts = {}) {
  const r = await fetch(`${API_URL}${path}`, opts);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

export const health = () => req("/health");
export const listFrames = () => req("/frames");

export async function analyzePhoto(fileOrBlob) {
  const fd = new FormData();
  fd.append("photo", fileOrBlob, "rostro.jpg");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${API_URL}/analyze`, { method: "POST", body: fd, signal: ctrl.signal });
    if (!r.ok) throw new Error(`analyze ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

export const recommend = (metrics, frame_ids = null) =>
  req("/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics, frame_ids }),
  });

export { API_URL };
