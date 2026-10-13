// Motor try-on: dibuja la montura sobre landmarks normalizados (MediaPipe 478).
// Sin assets externos: geometría procedural por forma. Sirve en vivo (video)
// y en foto (imagen capturada). v1.1: reemplazar por GLB en public/glasses/.
// v2: ajuste real por marco (A/B/D/ancho_total) + métricas (temporal/ipd).
const IDX = { leftOuter: 33, leftInner: 133, rightInner: 362, rightOuter: 263, nose: 168 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Color real del catálogo (nombres en español) → hex para render fotorrealista.
// Sin esto todo se veía fucsia/cyan "de juguete".
function frameColorHex(name = "") {
  const n = String(name).toLowerCase();
  if (n.includes("dorado rosa")) return "#d8a08a";
  if (n.includes("dorado-verde") || n.includes("dorado verde")) return "#a89a4a";
  if (n.includes("dorado")) return "#c19a3a";
  if (n.includes("plateado") || n.includes("titanio") || n.includes("cristal")) return "#b8c0cc";
  if (n.includes("carey oscuro") || n.includes("habana")) return "#5b2f12";
  if (n.includes("carey claro") || n.includes("miel")) return "#a06a24";
  if (n.includes("carey")) return "#6b3d14";
  if (n.includes("borgo")) return "#6b1a2a";
  if (n.includes("rojo") || n.includes("naranja")) return "#8f2a1e";
  if (n.includes("azul marino") || n.includes("azul oscuro")) return "#1e3a8a";
  if (n.includes("azul") || n.includes("verde")) return "#2f5f5f";
  if (n.includes("grafito")) return "#3a3f4a";
  if (n.includes("transparente")) return "#9fb3c8";
  if (n.includes("mate")) return "#26262b";
  if (n.includes("negro")) return "#17171a";
  return "#23232a";
}

function materialStyle(material = "acetato", ipdPx = 100) {
  const m = String(material).toLowerCase();
  if (m === "metal") return { edge: Math.max(1.6, ipdPx * 0.016), glass: "rgba(180,210,235,.10)", pads: true };
  if (m === "mixto") return { edge: Math.max(2.2, ipdPx * 0.024), glass: "rgba(180,210,235,.12)", pads: true };
  return { edge: Math.max(2.8, ipdPx * 0.034), glass: "rgba(140,180,220,.14)", pads: false }; // acetato grueso
}

export function measureGlasses(lm, cw, ch) {
  if (!lm || lm.length < 400) return null;
  const X = (p) => p.x * cw;
  const Y = (p) => p.y * ch;
  const lo = lm[IDX.leftOuter], li = lm[IDX.leftInner];
  const ri = lm[IDX.rightInner], ro = lm[IDX.rightOuter];
  const lc = { x: (X(lo) + X(li)) / 2, y: (Y(lo) + Y(li)) / 2 };
  const rc = { x: (X(ri) + X(ro)) / 2, y: (Y(ri) + Y(ro)) / 2 };
  const eyeWL = Math.hypot(X(li) - X(lo), Y(li) - Y(lo));
  const eyeWR = Math.hypot(X(ri) - X(ro), Y(ri) - Y(ro));
  const eyeW = (eyeWL + eyeWR) / 2;
  const ipdPx = Math.hypot(rc.x - lc.x, rc.y - lc.y);
  const ang = Math.atan2(rc.y - lc.y, rc.x - lc.x);
  const angDeg = Math.abs((ang * 180) / Math.PI);
  const asym = eyeW > 1 ? Math.abs(eyeWL - eyeWR) / eyeW : 0;
  const warnings = [];
  if (angDeg > 15) warnings.push(`Rostro rotado ${angDeg.toFixed(0)}° (máx 15°) — mira de frente`);
  if (asym > 0.25) warnings.push("Asimetría alta entre ojos — centra el rostro y mejora la luz");
  if (ipdPx < cw * 0.08) warnings.push("Rostro muy lejos — acércate a la cámara");
  return { lc, rc, eyeW, eyeWL, eyeWR, ipdPx, ang, angDeg, asym, warnings, nose: lm[IDX.nose] };
}

// Suavizado exponencial anti-temblor para vivo (prev=null en primer frame).
export function smoothLandmarks(prev, curr, alpha = 0.55) {
  if (!curr) return prev;
  if (!prev || prev.length !== curr.length) return curr;
  const out = new Array(curr.length);
  for (let i = 0; i < curr.length; i++) {
    const p = prev[i], c = curr[i];
    out[i] = { x: p.x + (c.x - p.x) * alpha, y: p.y + (c.y - p.y) * alpha, z: (p.z ?? 0) + ((c.z ?? 0) - (p.z ?? 0)) * alpha };
  }
  return out;
}

// Descentramiento pupilar: distancia centro óptico del marco vs IPD real.
// Marco ideal: A + D ≈ IPD. Si difiere >2mm por ojo, avisar (calidad óptica).
export function pupilDecentration(frame, metrics) {
  if (!frame?.A_mm || !frame?.D_mm || !metrics?.ipd_mm_est) return null;
  const framePD = frame.A_mm + frame.D_mm;
  const diff = Math.abs(framePD - metrics.ipd_mm_est);
  return { framePD: Number(framePD.toFixed(1)), diff: Number(diff.toFixed(1)), perEye: Number((diff / 2).toFixed(1)), ok: diff <= 4 };
}

export function drawGlasses(ctx, lm, vw, vh, cw, ch, forma = "rectangular", color = "#0ea5e9", opts = {}) {
  if (!lm || lm.length < 400) return null;
  // vw/vh se mantienen por compatibilidad; los landmarks son normalizados 0-1,
  // así que el mapeo real es p.x*cw / p.y*ch.
  void vw; void vh;
  const m = measureGlasses(lm, cw, ch);
  if (!m) return null;
  const { lc, rc, eyeW, ipdPx, ang } = m;
  const frame = opts.frame || null;
  const metrics = opts.metrics || null;
  // Color real del modelo elegido. El `color` param queda solo como fallback
  // legacy (antes cyan/fucsia fijo = vista "de chiste").
  const frameHex = frame?.color ? frameColorHex(frame.color) : (color || "#23232a");
  const mat = materialStyle(frame?.material, ipdPx);

  // Escala real: ancho_total_marco vs ancho temporal estimado.
  let fitScale = 1;
  if (frame?.ancho_total_mm && metrics?.temporal_est) {
    fitScale = clamp(frame.ancho_total_mm / metrics.temporal_est, 0.85, 1.25);
  }
  const W = eyeW * 2.1 * fitScale;
  const isRimless = forma === "rimless";
  let ratioHB = null;
  if (frame?.A_mm && frame?.B_mm && frame.A_mm > 0) {
    ratioHB = clamp(frame.B_mm / frame.A_mm, 0.6, 1.0);
  }
  const H = W * (ratioHB ??
    (forma === "aviador" ? 0.95 : forma === "redondo" ? 0.92 : forma === "oval" || forma === "rimless" ? 0.72 : forma === "wayfarer" ? 0.85 : forma === "cat-eye" ? 0.78 : 0.68));

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const edge = isRimless ? Math.max(1.4, ipdPx * 0.012) : mat.edge;
  // Luz real: en fotos oscuras el cristal se aclara, en fotos muy claras se oscurece.
  const light = clamp(opts.light ?? 0.5, 0, 1);
  const glassAlpha = 0.07 + (1 - light) * 0.08;
  const glassFill = isRimless
    ? `rgba(180,215,245,${(glassAlpha * 0.7).toFixed(3)})`
    : `rgba(150,190,225,${glassAlpha.toFixed(3)})`;
  const alpha = clamp(opts.alpha ?? 1, 0.25, 1);
  ctx.globalAlpha = alpha;

  // Traza el contorno del lente sin pintar (para pasadas sombra/vidrio/marco/brillo).
  const traceLens = (cx, cy, mirror = 1) => {
    ctx.beginPath();
    if (forma === "redondo" || forma === "oval" || forma === "rimless") {
      ctx.ellipse(cx, cy, W / 2, H / 2, ang, 0, Math.PI * 2);
    } else if (forma === "aviador") {
      // gota: más alto interno, curva inferior
      ctx.ellipse(cx, cy + H * 0.06, W / 2, H / 2, ang + mirror * 0.12, 0, Math.PI * 2);
    } else if (forma === "cat-eye") {
      // cat-eye: elevación angular en el extremo exterior superior
      const w = W / 2, h = H / 2;
      const m = mirror; // -1 for left eye (cx - w is outer), 1 for right eye (cx + w is outer)
      const outerX = cx + m * w * 1.05;
      const innerX = cx - m * w * 0.85;
      ctx.moveTo(innerX, cy - h * 0.3);
      ctx.quadraticCurveTo(cx, cy - h * 0.9, outerX, cy - h * 1.15);
      ctx.quadraticCurveTo(cx + m * w * 0.8, cy + h * 0.6, cx, cy + h * 0.85);
      ctx.quadraticCurveTo(cx - m * w * 0.7, cy + h * 0.5, innerX, cy - h * 0.3);
      ctx.closePath();
    } else if (forma === "wayfarer") {
      // trapecio: ancho arriba
      const w = W / 2, h = H / 2;
      ctx.moveTo(cx - w, cy - h * 0.9);
      ctx.lineTo(cx + w, cy - h * 0.9);
      ctx.lineTo(cx + w * 0.82, cy + h);
      ctx.lineTo(cx - w * 0.82, cy + h);
      ctx.closePath();
    } else {
      // rectangular / cuadrado: esquinas suaves
      const w = W / 2, h = H / 2, r = Math.min(w, h) * (forma === "cuadrado" ? 0.18 : 0.32);
      ctx.moveTo(cx - w + r, cy - h);
      ctx.arcTo(cx + w, cy - h, cx + w, cy + h, r);
      ctx.arcTo(cx + w, cy + h, cx - w, cy + h, r);
      ctx.arcTo(cx - w, cy + h, cx - w, cy - h, r);
      ctx.arcTo(cx - w, cy - h, cx + w, cy - h, r);
      ctx.closePath();
    }
  };

  const paintLens = (cx, cy, mirror = 1) => {
    // 1) Sombra suave (profundidad, no "sticker" plano)
    traceLens(cx, cy, mirror);
    ctx.save();
    ctx.translate(1.2, 1.6);
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = edge;
    ctx.stroke();
    ctx.restore();
    // 2) Cristal del lente (tinte neutro, no fucsia)
    traceLens(cx, cy, mirror);
    ctx.fillStyle = glassFill;
    ctx.fill();
    // 3) Marco con color real del modelo elegido
    traceLens(cx, cy, mirror);
    ctx.strokeStyle = isRimless ? "rgba(200,230,255,.5)" : frameHex;
    ctx.lineWidth = edge;
    ctx.stroke();
    // 4) Brillo superior (reflejo de luz = acabado real)
    if (!isRimless) {
      ctx.save();
      traceLens(cx, cy, mirror);
      ctx.clip();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,.30)";
      ctx.lineWidth = Math.max(1, edge * 0.28);
      ctx.moveTo(cx - W * 0.32, cy - H * 0.30);
      ctx.quadraticCurveTo(cx, cy - H * 0.42, cx + W * 0.32, cy - H * 0.30);
      ctx.stroke();
      ctx.restore();
    }
  };

  paintLens(lc.x, lc.y, -1);
  paintLens(rc.x, rc.y, 1);
  // puente: ancho ajustado por D_mm vs puente nasal estimado, color del marco
  const noseX = m.nose.x * cw;
  const noseY = m.nose.y * ch;
  let bridgeLift = 0.28;
  if (frame?.D_mm && metrics?.nose_bridge_mm_est) {
    bridgeLift = clamp(0.28 * (frame.D_mm / metrics.nose_bridge_mm_est), 0.2, 0.38);
  }
  ctx.strokeStyle = isRimless ? "rgba(200,230,255,.5)" : frameHex;
  ctx.lineWidth = edge * 0.9;
  ctx.beginPath();
  ctx.moveTo(lc.x + W / 2, lc.y - H * 0.12);
  ctx.quadraticCurveTo(
    noseX, noseY - H * bridgeLift,
    rc.x - W / 2, rc.y - H * 0.12
  );
  ctx.stroke();
  // plaquetas nasales en metal/mixto (detalle óptico real)
  if (mat.pads && !isRimless) {
    ctx.fillStyle = "rgba(220,230,240,.55)";
    const padW = Math.max(2, ipdPx * 0.03), padH = Math.max(4, ipdPx * 0.055);
    ctx.beginPath();
    ctx.ellipse(noseX - padW * 1.6, noseY + padH * 0.4, padW / 2, padH / 2, 0.25, 0, Math.PI * 2);
    ctx.ellipse(noseX + padW * 1.6, noseY + padH * 0.4, padW / 2, padH / 2, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  // patillas hacia sienes con color del marco
  ctx.beginPath();
  ctx.moveTo(lc.x - W / 2, lc.y - H * 0.1);
  ctx.lineTo(lc.x - W / 2 - ipdPx * 0.45, lc.y - H * 0.18);
  ctx.moveTo(rc.x + W / 2, rc.y - H * 0.1);
  ctx.lineTo(rc.x + W / 2 + ipdPx * 0.45, rc.y - H * 0.18);
  ctx.stroke();
  ctx.restore();
  return { ...m, lensW: W, lensH: H, fitScale, forma, frameColor: frameHex, frameId: frame?.id ?? null, decent: pupilDecentration(frame, metrics) };
}
