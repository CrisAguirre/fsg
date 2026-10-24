// Try-on 2D fotorrealista para modo foto.
// Usa recortes transparentes por montura (public/tryon/<forma>-frame.webp)
// y un segundo recorte para el cristal. Si no hay asset, devuelve null y el
// Scanner conserva el fallback procedural.
import { measureGlasses, pupilDecentration, frameColorHex } from "./GlassesOverlay.js";

const ASSET_BASE = "/tryon";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let manifestPromise = null;
const imageCache = new Map();
const tintCache = new Map();

async function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(`${ASSET_BASE}/manifest.json`, { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return manifestPromise;
}

function loadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  imageCache.set(url, p);
  return p;
}

function hexToRgb(hex) {
  try {
    const h = String(hex).replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(v, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  } catch {
    return null;
  }
}

function isNearBlack(hex) {
  const c = hexToRgb(hex);
  return !c || Math.max(c.r, c.g, c.b) < 70;
}

function tintedFrame(asset, frame) {
  const color = frameColorHex(frame?.color || "negro");
  const material = String(frame?.material || "acetato").toLowerCase();
  const transparent = /cristal|transparente/i.test(String(frame?.color || ""));
  const key = `${asset.key}|${color}|${material}|${transparent}`;
  if (tintCache.has(key)) return tintCache.get(key);

  const img = asset.frameImg;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || asset.meta.width;
  c.height = img.naturalHeight || asset.meta.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);

  // El recorte base suele ser negro; se tiñe solo cuando el catálogo pide
  // otro color. Para acetatos/carey se busca un tinte cálido, no un filtro plano.
  if (!isNearBlack(color)) {
    x.globalCompositeOperation = "source-atop";
    x.globalAlpha = transparent ? 0.38 : material === "metal" || material === "mixto" ? 0.42 : 0.52;
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "source-over";
    x.globalAlpha = 1;
  }
  tintCache.set(key, c);
  return c;
}

function lensOpacity(tint, light = 0.5) {
  const t = String(tint || "monofocal").toLowerCase();
  const lightAdj = clamp(0.06 + (1 - clamp(light, 0, 1)) * 0.06, 0.06, 0.14);
  if (t.includes("polarizado") || t.includes("sol")) return 0.5;
  if (t.includes("fotocrom")) return 0.3;
  if (t.includes("blue")) return 0.18;
  if (t.includes("progresivo") || t.includes("bifocal")) return 0.16;
  return 0.12 + lightAdj;
}

/**
 * Carga y dibuja el recorte fotorrealista de una montura.
 * @returns {Promise<null|object>} null si no hay asset; objeto con métricas si dibujó.
 */
export async function drawPhotoTryOn(ctx, lm, cw, ch, frame, metrics, opts = {}) {
  if (!ctx || !lm || !frame) return null;
  const m = measureGlasses(lm, cw, ch);
  if (!m) return null;

  const manifest = await loadManifest();
  const keys = [];
  if (frame.tryon_key) keys.push(String(frame.tryon_key));
  if (frame.forma) {
    const f = String(frame.forma).toLowerCase().trim();
    keys.push(f);
    if (f.includes("-")) keys.push(f.replace(/-/g, ""));
    if (f.includes("_")) keys.push(f.replace(/_/g, "-"));
  }
  let asset = null;
  for (const key of keys) {
    const meta = manifest[key];
    if (!meta?.frame) continue;
    const [frameImg, lensImg] = await Promise.all([
      loadImage(meta.frame),
      meta.lens ? loadImage(meta.lens) : Promise.resolve(null),
    ]);
    if (frameImg) {
      asset = { key, meta, frameImg, lensImg };
      break;
    }
  }
  if (!asset) return null;

  const meta = asset.meta;
  const aw = Number(meta.width) || asset.frameImg.naturalWidth || 1;
  const ah = Number(meta.height) || asset.frameImg.naturalHeight || 1;
  const p0 = { x: meta.lensCenters[0][0] * aw, y: meta.lensCenters[0][1] * ah };
  const p1 = { x: meta.lensCenters[1][0] * aw, y: meta.lensCenters[1][1] * ah };
  const pMid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const qMid = { x: (m.lc.x + m.rc.x) / 2, y: (m.lc.y + m.rc.y) / 2 };
  const dp = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (dp < 1) return null;
  const scale = m.ipdPx / dp;
  const angle = Math.atan2(m.rc.y - m.lc.y, m.rc.x - m.lc.x) - Math.atan2(p1.y - p0.y, p1.x - p0.x);

  const frameCanvas = tintedFrame(asset, frame);
  const alpha = clamp(opts.alpha ?? 1, 0.25, 1);
  const transparent = /cristal|transparente/i.test(String(frame?.color || ""));
  const frameAlpha = transparent ? alpha * 0.62 : alpha;
  const lensAlpha = lensOpacity(opts.tint, opts.light);
  const shadowBlur = Math.max(4, m.ipdPx * 0.07);
  const shadowY = Math.max(2, m.ipdPx * 0.018);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(qMid.x, qMid.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.translate(-pMid.x, -pMid.y);

  // Sombra de contacto: la montura debe "apoyarse" en la piel, no flotar.
  ctx.save();
  ctx.globalAlpha = frameAlpha * 0.42;
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = shadowBlur / scale;
  ctx.shadowOffsetY = shadowY / scale;
  ctx.drawImage(frameCanvas, 0, 0);
  ctx.restore();

  // Cristal real del recorte (reflejos incluidos) a baja opacidad para que
  // se vean los ojos. El aro se dibuja encima.
  if (asset.lensImg) {
    ctx.save();
    ctx.globalAlpha = lensAlpha;
    ctx.drawImage(asset.lensImg, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = frameAlpha;
  ctx.drawImage(frameCanvas, 0, 0);
  ctx.restore();

  const frameW = aw * scale;
  const frameH = ah * scale;
  return {
    ...m,
    fitScale: 1,
    lensW: frameW,
    lensH: frameH,
    frameW,
    frameH,
    forma: frame.forma,
    frameColor: frameColorHex(frame.color || "negro"),
    frameId: frame.id ?? null,
    decent: pupilDecentration(frame, metrics),
    mode3D: false,
    modePhoto: true,
    assetKey: asset.key,
    warnings: m.warnings,
  };
}

/** Precarga el asset para que el primer cambio de montura no parpadee. */
export async function preloadPhotoTryOn(frame) {
  if (!frame) return false;
  const manifest = await loadManifest();
  const keys = [];
  if (frame.tryon_key) keys.push(String(frame.tryon_key));
  if (frame.forma) {
    const f = String(frame.forma).toLowerCase().trim();
    keys.push(f);
    if (f.includes("-")) keys.push(f.replace(/-/g, ""));
    if (f.includes("_")) keys.push(f.replace(/_/g, "-"));
  }
  for (const key of keys) {
    const meta = manifest[key];
    if (meta?.frame) {
      const [a] = await Promise.all([loadImage(meta.frame), meta.lens ? loadImage(meta.lens) : null]);
      if (a) return true;
    }
  }
  return false;
}
