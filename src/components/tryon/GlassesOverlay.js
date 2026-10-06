// Motor try-on: dibuja la montura sobre landmarks normalizados (MediaPipe 478).
// Sin assets externos: geometría procedural por forma. Sirve en vivo (video)
// y en foto (imagen capturada). v1.1: reemplazar por GLB en public/glasses/.
const IDX = { leftOuter: 33, leftInner: 133, rightInner: 362, rightOuter: 263, nose: 168 };

export function drawGlasses(ctx, lm, vw, vh, cw, ch, forma = "rectangular", color = "#0ea5e9") {
  if (!lm || lm.length < 400) return;
  const X = (p) => p.x * vw * (cw / vw);
  const Y = (p) => p.y * vh * (ch / vh);
  const lo = lm[IDX.leftOuter], li = lm[IDX.leftInner];
  const ri = lm[IDX.rightInner], ro = lm[IDX.rightOuter];
  const nose = lm[IDX.nose];
  const lc = { x: (X(lo) + X(li)) / 2, y: (Y(lo) + Y(li)) / 2 };
  const rc = { x: (X(ri) + X(ro)) / 2, y: (Y(ri) + Y(ro)) / 2 };
  const eyeW = Math.hypot(X(li) - X(lo), Y(li) - Y(lo));
  const ipd = Math.hypot(rc.x - lc.x, rc.y - lc.y);
  const W = eyeW * 2.1; // ancho lente ≈ 2.1× ancho ojo
  const H = W * (forma === "aviador" ? 0.95 : forma === "redondo" ? 0.92 : forma === "oval" ? 0.72 : forma === "wayfarer" ? 0.85 : 0.68);
  const ang = Math.atan2(rc.y - lc.y, rc.x - lc.x);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, ipd * 0.02);
  ctx.fillStyle = "rgba(0,212,255,.08)";

  const lens = (cx, cy, mirror = 1) => {
    ctx.beginPath();
    if (forma === "redondo" || forma === "oval") {
      ctx.ellipse(cx, cy, W / 2, H / 2, ang, 0, 7);
    } else if (forma === "aviador") {
      // gota: más alto interno, curva inferior
      ctx.ellipse(cx, cy + H * 0.06, W / 2, H / 2, ang + mirror * 0.12, 0, 7);
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
    ctx.fill();
    ctx.stroke();
  };

  lens(lc.x, lc.y, -1);
  lens(rc.x, rc.y, 1);
  // puente
  ctx.beginPath();
  ctx.moveTo(lc.x + W / 2, lc.y - H * 0.12);
  ctx.quadraticCurveTo(
    (X(nose)), Y(nose) - H * 0.28,
    rc.x - W / 2, rc.y - H * 0.12
  );
  ctx.stroke();
  // patillas hacia sienes
  ctx.beginPath();
  ctx.moveTo(lc.x - W / 2, lc.y - H * 0.1);
  ctx.lineTo(lc.x - W / 2 - ipd * 0.45, lc.y - H * 0.18);
  ctx.moveTo(rc.x + W / 2, rc.y - H * 0.1);
  ctx.lineTo(rc.x + W / 2 + ipd * 0.45, rc.y - H * 0.18);
  ctx.stroke();
  ctx.restore();
}
