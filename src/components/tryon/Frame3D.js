// Armazón 3D real para probador (Three.js, sin GLB externos).
// Construye 8 monturas procedurales con volumen (aro extruido, puente, patillas,
// plaquetas) y las ancla a la pose de la cabeza estimada de los 478 landmarks.
// Uso:
//   const ar = new GlassesAR(canvas); ar.setModel(frame, tint); ar.render(lm, cw, ch, metrics)
import * as THREE from "three";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const IDX = { lo: 33, li: 133, ri: 362, ro: 263, nose: 168, fore: 10, chin: 152 };

export function frameColorHex(name = "") {
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

function glassTintMaterial(tint = "monofocal") {
  const t = String(tint || "monofocal").toLowerCase();
  let color = 0xcfe0f0, opacity = 0.16;
  if (t.includes("polarizado")) { color = 0x2c3a44; opacity = 0.55; }
  else if (t.includes("fotocrom")) { color = 0x6f7480; opacity = 0.38; }
  else if (t.includes("blue")) { color = 0xe8d9a8; opacity = 0.22; }
  else if (t.includes("progresivo") || t.includes("bifocal")) { color = 0xa9c8e8; opacity = 0.2; }
  return new THREE.MeshPhysicalMaterial({
    color, transparent: true, opacity, roughness: 0.06, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide,
  });
}

function frameMaterial(frame) {
  const m = String(frame?.material || "acetato").toLowerCase();
  const c = new THREE.Color(frameColorHex(frame?.color));
  if (m === "metal" || m === "mixto") {
    return new THREE.MeshStandardMaterial({ color: c, metalness: 0.9, roughness: 0.32 });
  }
  return new THREE.MeshStandardMaterial({ color: c, metalness: 0.15, roughness: 0.42 });
}

// Contorno del lente en unidades locales (IPD = 1, ojos en x=±0.5).
function lensShape(forma, w, h, mirror = 1) {
  const s = new THREE.Shape();
  const x = w / 2, y = h / 2;
  if (forma === "redondo") {
    s.absellipse(0, 0, x, y * 0.98, 0, Math.PI * 2);
  } else if (forma === "oval" || forma === "rimless") {
    s.absellipse(0, 0, x, y, 0, Math.PI * 2);
  } else if (forma === "aviador") {
    s.moveTo(-x * 0.92, -y * 0.55);
    s.bezierCurveTo(x * 0.92, -y * 0.55, x * 1.02, y * 0.1, x * 0.72, y * 0.72);
    s.bezierCurveTo(x * 0.3, y * 1.05, -x * 0.3, y * 1.05, -x * 0.72, y * 0.72);
    s.bezierCurveTo(-x * 1.02, y * 0.1, -x * 0.92, -y * 0.55, -x * 0.92, -y * 0.55);
  } else if (forma === "cat-eye") {
    const m = mirror;
    s.moveTo(-m * x * 0.82, -y * 0.25);
    s.quadraticCurveTo(0, -y * 0.95, m * x * 1.08, -y * 1.18);
    s.quadraticCurveTo(m * x * 0.95, -y * 0.2, m * x * 0.72, y * 0.55);
    s.quadraticCurveTo(m * x * 0.3, y * 0.95, 0, y * 0.88);
    s.quadraticCurveTo(-m * x * 0.75, y * 0.8, -m * x * 0.82, y * 0.1);
    s.quadraticCurveTo(-m * x * 0.9, -y * 0.1, -m * x * 0.82, -y * 0.25);
  } else if (forma === "wayfarer") {
    const r = Math.min(x, y) * 0.35;
    s.moveTo(-x + r, -y * 0.95);
    s.lineTo(x - r, -y * 0.95);
    s.quadraticCurveTo(x, -y * 0.95, x * 0.9, -y * 0.4);
    s.lineTo(x * 0.82, y);
    s.quadraticCurveTo(x * 0.8, y * 1.02, x * 0.72, y);
    s.lineTo(-x * 0.72, y);
    s.quadraticCurveTo(-x * 0.8, y * 1.02, -x * 0.82, y);
    s.lineTo(-x * 0.9, -y * 0.4);
    s.quadraticCurveTo(-x, -y * 0.95, -x + r, -y * 0.95);
  } else {
    // rectangular / cuadrado
    const r = Math.min(x, y) * (forma === "cuadrado" ? 0.25 : 0.42);
    s.moveTo(-x + r, -y);
    s.lineTo(x - r, -y);
    s.quadraticCurveTo(x, -y, x, -y + r);
    s.lineTo(x, y - r);
    s.quadraticCurveTo(x, y, x - r, y);
    s.lineTo(-x + r, y);
    s.quadraticCurveTo(-x, y, -x, y - r);
    s.lineTo(-x, -y + r);
    s.quadraticCurveTo(-x, -y, -x + r, -y);
  }
  return s;
}

export function buildGlassesGroup(frame, tint = "monofocal", dims = null) {
  const forma = frame?.forma || "rectangular";
  const isRimless = forma === "rimless";
  const isMetal = /metal|mixto/i.test(String(frame?.material || ""));
  // Tamaño óptico real: el lente mide A/IPD y B/IPD en unidades de IPD (ojos en ±0.5).
  // Sin métricas, fallback proporcional clásico.
  const lensW = dims?.lensW ?? 0.44 * (dims?.fitScale ?? 1);
  const lensH = dims?.lensH ?? lensW * (forma === "aviador" ? 0.95 : forma === "redondo" ? 0.92 : forma === "oval" || isRimless ? 0.72 : forma === "wayfarer" ? 0.85 : forma === "cat-eye" ? 0.78 : 0.68);
  const lensCX = dims?.lensCX ?? 0.5; // centro óptico: ±lensCX (0.5 = sobre la pupila)
  const depth = isRimless ? 0.008 : isMetal ? 0.03 : 0.055;

  const g = new THREE.Group();
  const rimMat = frameMaterial(frame);
  const glassMat = glassTintMaterial(tint);

  for (const side of [-1, 1]) {
    const shape = lensShape(forma, lensW, lensH, side);
    // Cristal
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), glassMat);
    glass.position.set(side * lensCX, 0, depth * 0.4);
    g.add(glass);
    if (!isRimless) {
      // Aro con volumen real
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: depth * 0.3, bevelSegments: 2, curveSegments: 28,
      });
      geo.translate(0, 0, -depth / 2);
      const rim = new THREE.Mesh(geo, rimMat);
      rim.position.set(side * lensCX, 0, 0);
      g.add(rim);
      // Barra superior wayfarer / ceja aviador
      if (forma === "wayfarer") {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(lensW * 0.98, depth * 1.6, depth * 1.3), rimMat);
        bar.position.set(side * lensCX, lensH * 0.48, 0);
        g.add(bar);
      }
    } else {
      // Rimless: mini soportes + hilo superior
      const sup = new THREE.Mesh(new THREE.BoxGeometry(lensW * 0.7, 0.012, 0.012), rimMat);
      sup.position.set(side * lensCX, lensH * 0.42, 0);
      g.add(sup);
      const mountMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ef, metalness: 0.9, roughness: 0.3 });
      for (const dx of [-lensW * 0.28, lensW * 0.28]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), mountMat);
        dot.position.set(side * lensCX + dx, -lensH * 0.05, depth * 0.5);
        g.add(dot);
      }
    }
    // Patilla hacia atrás (oreja): del borde exterior hacia -Z
    const outerX = side * (lensCX + lensW / 2);
    const templeLen = 0.85;
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, templeLen), rimMat);
    temple.position.set(outerX + side * 0.02, lensH * 0.28, -templeLen / 2);
    temple.rotation.y = side * -0.06;
    g.add(temple);
    // Bisagra
    const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 12), new THREE.MeshStandardMaterial({ color: 0xdfe6ef, metalness: 0.9, roughness: 0.3 }));
    hinge.position.set(outerX, lensH * 0.28, 0);
    g.add(hinge);
  }

  // Puente
  // Puente: ancho real D/IPD; lentes a ±(A+D)/2 del centro nasal
  const innerGap = dims?.bridgeW ?? Math.max(0.1, 1 - lensW);
  if (forma === "aviador") {
    // doble puente aviador
    const barMat = rimMat;
    const top = new THREE.Mesh(new THREE.BoxGeometry(innerGap + lensW * 0.5, 0.03, 0.03), barMat);
    top.position.set(0, lensH * 0.52, 0);
    g.add(top);
  }
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-innerGap / 2, lensH * 0.28, 0),
    new THREE.Vector3(0, lensH * 0.28 - 0.1, 0.02),
    new THREE.Vector3(innerGap / 2, lensH * 0.28, 0),
  );
  const bridge = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, isMetal ? 0.016 : 0.032, 8), rimMat);
  g.add(bridge);

  // Plaquetas en metal
  if (isMetal && !isRimless) {
    const padMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ef, roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.85 });
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), padMat);
      pad.scale.set(0.6, 1, 0.4);
      pad.position.set(s * 0.09, -0.02, -0.02);
      g.add(pad);
    }
  }
  return g;
}

function estimatePose(lm) {
  const P = (i) => lm[i];
  const eyeL = { x: (P(IDX.lo).x + P(IDX.li).x) / 2, y: (P(IDX.lo).y + P(IDX.li).y) / 2 };
  const eyeR = { x: (P(IDX.ri).x + P(IDX.ro).x) / 2, y: (P(IDX.ri).y + P(IDX.ro).y) / 2 };
  const nose = P(IDX.nose), fore = P(IDX.fore), chin = P(IDX.chin);
  const cx = (eyeL.x + eyeR.x) / 2, cy = (eyeL.y + eyeR.y) / 2;
  const ipd = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);
  const roll = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);
  const dl = Math.hypot(nose.x - eyeL.x, nose.y - eyeL.y) || 1e-6;
  const dr = Math.hypot(nose.x - eyeR.x, nose.y - eyeR.y) || 1e-6;
  const yaw = clamp(((dr - dl) / (dr + dl)) * 2.4, -0.65, 0.65);
  const faceH = Math.hypot(chin.x - fore.x, chin.y - fore.y) || 1e-6;
  const pitch = clamp((((nose.y - cy) / faceH) - 0.14) * 3.2, -0.38, 0.38);
  return { cx, cy, ipd, roll, yaw, pitch };
}

export class GlassesAR {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    // Cámara lejos con frustum amplio: al girar la cabeza los bordes del
    // armazón se acercan a la cámara y con near/far justos se recortaban.
    // En ortográfica la distancia no cambia el tamaño, solo el rango visible.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1200);
    this.camera.position.set(0, 0, 600);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(1.5, 2, 4);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xbcd2ff, 0.5);
    fill.position.set(-2, -1, 3);
    this.scene.add(fill);
    this.group = null;
    this.key = "";
  }

  setModel(frame, tint = "monofocal", metrics = null) {
    const key = `${frame?.id ?? frame?.forma ?? "?"}|${tint}|${frame?.color}|${frame?.material}|${metrics?.ipd_mm_est ?? "?"}`;
    if (key === this.key) return;
    this.key = key;
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => { o.geometry?.dispose?.(); });
    }
    // Dimensiones ópticas reales en unidades IPD (1.0 = tu IPD).
    // Ej: A52/D18 con IPD63 → lente 0.83, centros ±0.56, puente 0.29.
    let dims = null;
    const ipd = Number(metrics?.ipd_mm_est);
    if (frame?.A_mm && frame?.B_mm && frame?.D_mm && ipd > 0) {
      const lensW = clamp(frame.A_mm / ipd, 0.55, 1.05);
      const lensH = clamp(frame.B_mm / ipd, 0.35, 0.9);
      const lensCX = clamp((frame.A_mm + frame.D_mm) / 2 / ipd, 0.4, 0.7);
      dims = { lensW, lensH, lensCX, bridgeW: clamp(frame.D_mm / ipd, 0.12, 0.45) };
    } else {
      let fitScale = 1, ratioHB = null;
      if (frame?.ancho_total_mm && metrics?.temporal_est) {
        fitScale = clamp(frame.ancho_total_mm / metrics.temporal_est, 0.85, 1.25);
      }
      if (frame?.A_mm && frame?.B_mm && frame.A_mm > 0) {
        ratioHB = clamp(frame.B_mm / frame.A_mm, 0.6, 1.0);
      }
      const lensW = 0.44 * fitScale;
      dims = {
        lensW,
        lensH: lensW * (ratioHB ?? 0.72),
        lensCX: 0.5,
        bridgeW: Math.max(0.1, 1 - lensW),
        fitScale,
      };
    }
    this.group = buildGlassesGroup(frame, tint, dims);
    this.scene.add(this.group);
  }

  render(lm, cw, ch) {
    if (!lm || lm.length < 400 || !this.group) return null;
    if (this.canvas.width !== Math.round(cw) || this.canvas.height !== Math.round(ch)) {
      this.canvas.width = Math.round(cw);
      this.canvas.height = Math.round(ch);
    }
    this.renderer.setSize(cw, ch, false);
    this.camera.left = -cw / 2; this.camera.right = cw / 2;
    this.camera.top = ch / 2; this.camera.bottom = -ch / 2;
    this.camera.updateProjectionMatrix();
    const pose = estimatePose(lm);
    const px = pose.cx * cw - cw / 2;
    const py = -(pose.cy * ch - ch / 2);
    this.group.position.set(px, py, 0);
    const s = pose.ipd * cw;
    this.group.scale.setScalar(Math.max(1e-6, s));
    // Orden YXZ: guiño (yaw) + cabeceo (pitch) + giro (roll)
    this.group.rotation.set(pose.pitch, pose.yaw, -pose.roll, "YXZ");
    this.renderer.render(this.scene, this.camera);
    return { yawDeg: pose.yaw * 57.3, pitchDeg: pose.pitch * 57.3, rollDeg: pose.roll * 57.3, ipdPx: pose.ipd * cw };
  }

  clear() {
    const ctx = this.canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
