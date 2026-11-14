// Try-on 2D fotorrealista para modo foto.
// Usa recortes transparentes por montura (public/tryon/<forma>-frame.webp)
// y un segundo recorte para el cristal. Si no hay asset, devuelve null y el
// Scanner conserva el fallback procedural.
import { measureGlasses, pupilDecentration } from "./GlassesOverlay.js";
import { frameColorHex, frameMaterialProfile, isDarkColor } from "./frameStyle.js";
import { mixLensColor, normalizeLensStyle } from "./lensStyle.js";

const ASSET_BASE = "/tryon";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Recortes 2D que sirven para superposición frontal. El resto de los assets
// salió de fotos de producto en 3/4 con patillas extendidas: al montarlos sobre
// un rostro quedan torcidos y con las patillas cruzando la cara. Esas formas
// usan el GLB 3D (frontal por construcción) y, si WebGL falla, el vectorial.
const FRONTAL_KEYS = new Set(["rectangular", "rimless"]);

let manifestPromise = null;
const imageCache = new Map();
const tintCache = new Map();
const lensMaskCache = new Map();

/** Claves de asset candidatas para una montura (tryon_key + forma). */
function assetKeys(frame) {
  const keys = [];
  if (frame?.tryon_key) keys.push(String(frame.tryon_key).toLowerCase().trim());
  if (frame?.forma) {
    const f = String(frame.forma).toLowerCase().trim();
    keys.push(f);
    if (f.includes("-")) keys.push(f.replace(/-/g, ""));
    if (f.includes("_")) keys.push(f.replace(/_/g, "-"));
  }
  return keys;
}

/** true si la montura tiene un recorte 2D frontal utilizable. */
export function hasFrontalPhotoAsset(frame) {
  if (!frame) return false;
  return assetKeys(frame).some((key) => FRONTAL_KEYS.has(key));
}

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

function tintedFrame(asset, frame) {
  const profile = frameMaterialProfile(frame);
  const color = profile.color;
  const key = `${asset.key}|${color}|${profile.finish}`;
  if (tintCache.has(key)) return tintCache.get(key);

  const img = asset.frameImg;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || asset.meta.width;
  c.height = img.naturalHeight || asset.meta.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);

  // El recorte base suele ser negro con brillos. Un relleno plano los borra;
  // en su lugar se colorea y después se recupera la luminosidad original con
  // el blend "luminosity", que conserva vetas, biseles y reflejos.
  if (!isDarkColor(color)) {
    x.globalCompositeOperation = "source-atop";
    x.globalAlpha = profile.tintStrength;
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);

    x.globalCompositeOperation = "luminosity";
    x.globalAlpha = 1;
    x.drawImage(img, 0, 0);

    if (profile.finish === "metal" || profile.finish === "mixed") {
      // Recupera los reflejos metálicos que el color base haya oscurecido.
      x.globalCompositeOperation = "screen";
      x.globalAlpha = 0.16;
      x.drawImage(img, 0, 0);
    }
    x.globalCompositeOperation = "source-over";
    x.globalAlpha = 1;
  }
  tintCache.set(key, c);
  return c;
}

/**
 * Silueta del cristal rellena con el color ya mezclado. Se cachea por
 * asset+color para que el slider no cree un canvas por cada paso.
 */
function lensSilhouette(asset, color) {
  if (!asset.lensImg) return null;
  const key = `${asset.key}|${color}`;
  if (lensMaskCache.has(key)) return lensMaskCache.get(key);
  const img = asset.lensImg;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || asset.meta.width;
  c.height = img.naturalHeight || asset.meta.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = "source-over";
  if (lensMaskCache.size > 24) lensMaskCache.clear();
  lensMaskCache.set(key, c);
  return c;
}

/**
 * Carga y dibuja el recorte fotorrealista de una montura.
 * @returns {Promise<null|object>} null si no hay asset; objeto con métricas si dibujó.
 */
export async function drawPhotoTryOn(ctx, lm, cw, ch, frame, metrics, opts = {}) {
  if (!ctx || !lm || !frame) return null;
  const m = measureGlasses(lm, cw, ch);
  if (!m) return null;
  if (!hasFrontalPhotoAsset(frame)) return null;

  const manifest = await loadManifest();
  const keys = assetKeys(frame);
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
  const profile = frameMaterialProfile(frame);
  const alpha = clamp(opts.alpha ?? 1, 0.25, 1);
  const frameAlpha = profile.finish === "transparent" ? alpha * 0.68 : alpha;
  // El slider de opacidad manda sobre el cristal; la luz de la foto solo
  // ajusta un poco para que no se vea plano en fotos oscuras.
  const lensStyle = normalizeLensStyle(opts.lensStyle, opts.tint);
  const lightAdj = (1 - clamp(opts.light ?? 0.5, 0, 1)) * 0.06;
  const lensAlpha = clamp(lensStyle.opacity + lightAdj, 0.02, 1);
  const lensColor = mixLensColor(lensStyle.color, lensStyle.intensity);
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
  // Se dibuja el armazón una vez con su sombra (sin reducir su alfa, que lo
  // oscurecía) y se vuelve a pintar al final por encima del cristal.
  ctx.save();
  ctx.globalAlpha = frameAlpha;
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = shadowBlur / scale;
  ctx.shadowOffsetY = shadowY / scale;
  ctx.drawImage(frameCanvas, 0, 0);
  ctx.restore();

  // Cristal real del recorte (reflejos incluidos) a baja opacidad para que
  // se vean los ojos. La silueta del color se multiplica para teñir sin
  // borrar los reflejos; después se recuperan los brillos con "screen".
  if (asset.lensImg) {
    ctx.save();
    ctx.globalAlpha = lensAlpha;
    ctx.drawImage(asset.lensImg, 0, 0);
    ctx.restore();
    const silhouette = lensSilhouette(asset, lensColor);
    if (silhouette && lensStyle.intensity > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = lensAlpha * (0.72 + lensStyle.intensity * 0.28);
      ctx.drawImage(silhouette, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = lensAlpha * 0.2;
      ctx.drawImage(asset.lensImg, 0, 0);
      ctx.restore();
    }
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
  if (!hasFrontalPhotoAsset(frame)) return false;
  const manifest = await loadManifest();
  const keys = assetKeys(frame);
  for (const key of keys) {
    const meta = manifest[key];
    if (meta?.frame) {
      const [a] = await Promise.all([loadImage(meta.frame), meta.lens ? loadImage(meta.lens) : null]);
      if (a) return true;
    }
  }
  return false;
}
