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

// Estilo por material: el grosor sale del IPD medido (no fijo).

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
  const frameHex = frame?.color ? frameColorHex(frame.color) : (color || "#23232a");
  const rimDark = shade(frameHex, -38);
  const rimLight = shade(frameHex, 42);
  const matName = String(frame?.material || "acetato").toLowerCase();
  const isMetal = matName === "metal" || matName === "mixto";
  const isCarey = /carey|habana|miel|torto/i.test(String(frame?.color || ""));
  const tint = lensTint(opts.tint, clamp(opts.light ?? 0.5, 0, 1));

  // Tamaño óptico real: el lente mide A/IPD y B/IPD del IPD en px.
  // Ej: A52 con IPD63 → lente 0.83×IPD. Fallback: 2.1× ancho de ojo.
  let W, H;
  const ipdMm = Number(metrics?.ipd_mm_est);
  if (frame?.A_mm && frame?.B_mm && ipdMm > 0 && ipdPx > 1) {
    const ratioHB = clamp(frame.B_mm / Math.max(frame.A_mm, 1e-6), 0.5, 1.05);
    W = (ipdPx * frame.A_mm) / ipdMm;
    H = W * ratioHB;
    // Tope anti-absurdos (foto muy lejos/cerca)
    const maxW = ipdPx * 1.1, minW = ipdPx * 0.5;
    W = clamp(W, minW, maxW);
    H = W * ratioHB;
  } else {
    // Escala real: ancho_total_marco vs ancho temporal estimado.
    let fitScale = 1;
    if (frame?.ancho_total_mm && metrics?.temporal_est) {
      fitScale = clamp(frame.ancho_total_mm / metrics.temporal_est, 0.85, 1.25);
    }
    W = eyeW * 2.1 * fitScale;
    const isRimless0 = forma === "rimless";
    let ratioHB0 = null;
    if (frame?.A_mm && frame?.B_mm && frame.A_mm > 0) {
      ratioHB0 = clamp(frame.B_mm / frame.A_mm, 0.6, 1.0);
    }
    H = W * (ratioHB0 ??
      (forma === "aviador" ? 0.95 : forma === "redondo" ? 0.92 : forma === "oval" || isRimless0 ? 0.72 : forma === "wayfarer" ? 0.85 : forma === "cat-eye" ? 0.78 : 0.68));
  }
  const isRimless = forma === "rimless";

  const edge = isRimless ? Math.max(1.4, ipdPx * 0.012) : isMetal ? Math.max(1.7, ipdPx * 0.017) : Math.max(3, ipdPx * 0.036);
  const alpha = clamp(opts.alpha ?? 1, 0.25, 1);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = alpha;

  const paintLens = (cx, cy, mirror = 1) => {
    const path = buildLensPath(W, H, forma, mirror);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    // 1) Sombra de apoyo (el marco "asienta" sobre la piel, no flota)
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = Math.max(3, edge * 2.2);
    ctx.shadowOffsetY = Math.max(1.5, edge * 0.7);
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.lineWidth = edge;
    ctx.stroke(path);
    ctx.restore();
    // 2) Cristal con degradado + tinte del tipo de lente
    const g = ctx.createRadialGradient(0, -H * 0.2, Math.min(W, H) * 0.1, 0, 0, Math.max(W, H) * 0.75);
    g.addColorStop(0, tint.hi);
    g.addColorStop(0.55, tint.mid);
    g.addColorStop(1, tint.lo);
    ctx.fillStyle = g;
    ctx.fill(path);
    // 3) Reflejo AR diagonal (banda de luz real, recortada al lente)
    ctx.save();
    ctx.clip(path);
    ctx.rotate(-0.5);
    const rg = ctx.createLinearGradient(-W, 0, W, 0);
    rg.addColorStop(0.32, "rgba(255,255,255,0)");
    rg.addColorStop(0.45, "rgba(255,255,255,.20)");
    rg.addColorStop(0.55, "rgba(255,255,255,.05)");
    rg.addColorStop(0.68, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(-W, -H, W * 2, H * 2);
    // brillo superior de borde (curvatura del lente)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.lineWidth = Math.max(1, edge * 0.22);
    ctx.moveTo(-W * 0.3, -H * 0.34);
    ctx.quadraticCurveTo(0, -H * 0.46, W * 0.3, -H * 0.34);
    ctx.stroke();
    ctx.restore();
    if (!isRimless) {
      // 4) Aro exterior (color oscuro = profundidad del acetato/metal)
      ctx.strokeStyle = isMetal ? metalGradient(ctx, W, rimDark, rimLight) : rimDark;
      ctx.lineWidth = edge;
      ctx.stroke(path);
      // 5) Bisel interior (filete de luz = grosor real del marco)
      ctx.strokeStyle = isCarey ? "rgba(255,205,130,.5)" : rimLight;
      ctx.lineWidth = Math.max(1, edge * 0.32);
      ctx.stroke(path);
      // 6) Veta carey (acetatos Havana/miel): moteado sobre el aro
      if (isCarey) {
        ctx.save();
        ctx.setLineDash([edge * 1.4, edge * 1.1]);
        ctx.lineDashOffset = mirror > 0 ? 2 : 7;
        ctx.strokeStyle = "rgba(46,22,6,.65)";
        ctx.lineWidth = edge * 0.55;
        ctx.stroke(path);
        ctx.restore();
      }
      // 7) Detalles por forma
      if (forma === "wayfarer") {
        // barra superior gruesa característica + remaches
        ctx.beginPath();
        ctx.strokeStyle = rimDark;
        ctx.lineWidth = edge * 1.15;
        ctx.moveTo(-W / 2, -H * 0.42);
        ctx.lineTo(W / 2, -H * 0.42);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.5)";
        for (const sx of [-W * 0.34, W * 0.34]) {
          ctx.beginPath();
          ctx.arc(sx, -H * 0.1, Math.max(1.2, edge * 0.22), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (forma === "aviador") {
        // ceja superior metálica (brow bar del aviador)
        ctx.beginPath();
        ctx.strokeStyle = isMetal ? metalGradient(ctx, W, rimDark, rimLight) : rimDark;
        ctx.lineWidth = Math.max(1.4, edge * 0.6);
        ctx.moveTo(-W / 2, -H * 0.52);
        ctx.quadraticCurveTo(0, -H * 0.72, W / 2, -H * 0.52);
        ctx.stroke();
      } else if (isMetal) {
        // tornillos laterales en metal
        ctx.fillStyle = "rgba(240,244,250,.75)";
        for (const sx of [-W / 2, W / 2]) {
          ctx.beginPath();
          ctx.arc(sx, 0, Math.max(1, edge * 0.28), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // remaches de acetato
        ctx.fillStyle = "rgba(255,255,255,.4)";
        for (const sx of [-W / 2 + edge * 0.6, W / 2 - edge * 0.6]) {
          ctx.beginPath();
          ctx.arc(sx, -H * 0.18, Math.max(1, edge * 0.18), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // rimless: soportes perforados + hilo fantasma
      ctx.strokeStyle = "rgba(200,230,255,.5)";
      ctx.lineWidth = edge;
      ctx.stroke(path);
      ctx.fillStyle = "rgba(230,240,250,.8)";
      for (const sx of [-W * 0.3, W * 0.3]) {
        ctx.beginPath();
        ctx.arc(sx, -H * 0.05, Math.max(1.2, edge * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  paintLens(lc.x, lc.y, -1);
  paintLens(rc.x, rc.y, 1);

  // Puente según forma: wayfarer = ojo de cerradura, metal = fino + plaquetas, acetato = silla gruesa
  const noseX = m.nose.x * cw;
  const noseY = m.nose.y * ch;
  let bridgeLift = 0.28;
  if (frame?.D_mm && metrics?.nose_bridge_mm_est) {
    bridgeLift = clamp(0.28 * (frame.D_mm / metrics.nose_bridge_mm_est), 0.2, 0.38);
  }
  ctx.strokeStyle = isRimless ? "rgba(200,230,255,.55)" : isMetal ? metalGradient(ctx, ipdPx, rimDark, rimLight) : rimDark;
  ctx.lineWidth = isRimless ? edge : edge * (forma === "wayfarer" ? 1.1 : 0.9);
  ctx.beginPath();
  if (forma === "wayfarer") {
    // ojo de cerradura: doble curva
    ctx.moveTo(lc.x + W / 2, lc.y - H * 0.3);
    ctx.quadraticCurveTo(noseX - W * 0.08, noseY - H * bridgeLift, noseX, noseY - H * (bridgeLift - 0.12));
    ctx.quadraticCurveTo(noseX + W * 0.08, noseY - H * bridgeLift, rc.x - W / 2, rc.y - H * 0.3);
  } else {
    ctx.moveTo(lc.x + W / 2, lc.y - H * 0.12);
    ctx.quadraticCurveTo(noseX, noseY - H * bridgeLift, rc.x - W / 2, rc.y - H * 0.12);
  }
  ctx.stroke();
  // filete de luz del puente (volumen)
  if (!isRimless) {
    ctx.strokeStyle = rimLight;
    ctx.lineWidth = Math.max(1, edge * 0.28);
    ctx.beginPath();
    ctx.moveTo(lc.x + W / 2, lc.y - H * 0.12 - edge * 0.35);
    ctx.quadraticCurveTo(noseX, noseY - H * bridgeLift - edge * 0.35, rc.x - W / 2, rc.y - H * 0.12 - edge * 0.35);
    ctx.stroke();
  }
  // plaquetas nasales en metal/mixto
  if ((isMetal) && !isRimless) {
    ctx.fillStyle = "rgba(225,233,242,.6)";
    ctx.strokeStyle = "rgba(120,135,155,.7)";
    ctx.lineWidth = 1;
    const padW = Math.max(2.5, ipdPx * 0.032), padH = Math.max(5, ipdPx * 0.06);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(noseX + s * padW * 1.7, noseY + padH * 0.5, padW / 2, padH / 2, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // Patillas con bisagra: tramo grueso + punto de bisagra metálico
  ctx.strokeStyle = isRimless ? "rgba(200,230,255,.55)" : rimDark;
  ctx.lineWidth = edge * 0.85;
  ctx.beginPath();
  ctx.moveTo(lc.x - W / 2, lc.y - H * 0.1);
  ctx.lineTo(lc.x - W / 2 - ipdPx * 0.45, lc.y - H * 0.18);
  ctx.moveTo(rc.x + W / 2, rc.y - H * 0.1);
  ctx.lineTo(rc.x + W / 2 + ipdPx * 0.45, rc.y - H * 0.18);
  ctx.stroke();
  ctx.fillStyle = isMetal ? "#dfe6ef" : rimLight;
  for (const hx of [lc.x - W / 2, rc.x + W / 2]) {
    ctx.beginPath();
    ctx.arc(hx, lc.y - H * 0.1, Math.max(1.2, edge * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return { ...m, lensW: W, lensH: H, fitScale, forma, frameColor: frameHex, frameId: frame?.id ?? null, decent: pupilDecentration(frame, metrics) };
}

// ── Geometría sólida del lente (Path2D centrado en 0,0) ──
function buildLensPath(W, H, forma, mirror = 1) {
  const p = new Path2D();
  const w = W / 2, h = H / 2;
  if (forma === "redondo") {
    p.ellipse(0, 0, w, h * 0.98, 0, 0, Math.PI * 2);
  } else if (forma === "oval" || forma === "rimless") {
    p.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  } else if (forma === "aviador") {
    // lágrima: estrecha arriba, amplia y redondeada abajo
    p.moveTo(-w * 0.92, -h * 0.55);
    p.bezierCurveTo(w * 0.92, -h * 0.55, w * 1.02, h * 0.1, w * 0.72, h * 0.72);
    p.bezierCurveTo(w * 0.3, h * 1.05, -w * 0.3, h * 1.05, -w * 0.72, h * 0.72);
    p.bezierCurveTo(-w * 1.02, h * 0.1, -w * 0.92, -h * 0.55, -w * 0.92, -h * 0.55);
    p.closePath();
  } else if (forma === "cat-eye") {
    // ojo de gato: comisura exterior afilada y elevada
    const m = mirror;
    const ox = m * w * 1.08, ix = -m * w * 0.82;
    p.moveTo(ix, -h * 0.25);
    p.quadraticCurveTo(0, -h * 0.95, ox, -h * 1.18);
    p.quadraticCurveTo(m * w * 0.95, -h * 0.2, m * w * 0.72, h * 0.55);
    p.quadraticCurveTo(m * w * 0.3, h * 0.95, 0, h * 0.88);
    p.quadraticCurveTo(-m * w * 0.75, h * 0.8, ix, h * 0.1);
    p.quadraticCurveTo(ix - m * w * 0.08, -h * 0.1, ix, -h * 0.25);
    p.closePath();
  } else if (forma === "wayfarer") {
    // trapecio redondeado: frente superior ancha y recta
    const r = Math.min(w, h) * 0.35;
    roundedTrap(p, -w, -h * 0.95, w, h, r);
  } else {
    // rectangular / cuadrado: radio según forma
    const r = Math.min(w, h) * (forma === "cuadrado" ? 0.22 : 0.38);
    roundedRect(p, -w, -h, w * 2, h * 2, r);
  }
  return p;
}

function roundedRect(p, x, y, w, h, r) {
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}

function roundedTrap(p, xTop, yTop, xBot, yBot, r) {
  // trapecio wayfarer con esquinas suavizadas
  const wt = Math.abs(xTop) * 2, wb = Math.abs(xBot) * 2;
  void wt; void wb;
  p.moveTo(xTop + r, yTop);
  p.lineTo(-xTop - r, yTop);
  p.arcTo(-xTop, yTop, -xBot, yBot, r);
  p.lineTo(xBot, yBot);
  p.arcTo(xBot, yBot, xTop, yTop, r);
  p.closePath();
}

// ── Color y luz ──
function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shade(hex, amt) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  } catch { return hex; }
}

function metalGradient(ctx, span, dark, light) {
  const g = ctx.createLinearGradient(-span / 2, 0, span / 2, 0);
  g.addColorStop(0, dark);
  g.addColorStop(0.45, light);
  g.addColorStop(0.55, "#f4f7fb");
  g.addColorStop(0.65, light);
  g.addColorStop(1, dark);
  return g;
}

// Tinte del cristal según tipo de lente elegido (además de la luz de la foto).
// Niveles con salto visible: cada tipo debe distinguirse a simple vista.
function lensTint(tint = "monofocal", light = 0.5) {
  const t = String(tint || "monofocal").toLowerCase();
  const base = 0.1 + (1 - light) * 0.08;
  if (t.includes("polarizado") || t.includes("sol")) {
    return { hi: `rgba(60,75,86,${(base + 0.45).toFixed(3)})`, mid: `rgba(38,52,62,${(base + 0.5).toFixed(3)})`, lo: `rgba(20,30,38,${(base + 0.55).toFixed(3)})` };
  }
  if (t.includes("fotocrom")) {
    return { hi: `rgba(140,146,158,${(base + 0.3).toFixed(3)})`, mid: `rgba(110,116,128,${(base + 0.34).toFixed(3)})`, lo: `rgba(85,90,102,${(base + 0.38).toFixed(3)})` };
  }
  if (t.includes("blue")) {
    return { hi: `rgba(240,190,90,${(base + 0.2).toFixed(3)})`, mid: `rgba(225,170,70,${(base + 0.24).toFixed(3)})`, lo: `rgba(200,145,50,${(base + 0.28).toFixed(3)})` };
  }
  if (t.includes("progresivo") || t.includes("bifocal")) {
    return { hi: `rgba(175,205,235,${(base + 0.1).toFixed(3)})`, mid: `rgba(150,185,220,${(base + 0.13).toFixed(3)})`, lo: `rgba(125,160,200,${(base + 0.16).toFixed(3)})` };
  }
  return { hi: `rgba(200,220,240,${base.toFixed(3)})`, mid: `rgba(170,200,228,${(base + 0.02).toFixed(3)})`, lo: `rgba(145,180,210,${(base + 0.04).toFixed(3)})` };
}
