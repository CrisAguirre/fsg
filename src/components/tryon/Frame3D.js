// Armazón 3D para probador (Three.js). Carga el GLB de la forma desde
// /glasses/manifest.json y lo ancla a la pose de los 478 landmarks; mientras
// carga o si falla, dibuja una montura procedural equivalente.
// Uso:
//   const ar = new GlassesAR(canvas); ar.setModel(frame, tint); ar.render(lm, cw, ch, metrics)
import * as THREE from "three";
import { buildGlbGroup, loadGlb } from "./GlassesGLB.js";
import { frameColorHex, lensKind, LENS_KIND } from "./frameStyle.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const IDX = { lo: 33, li: 133, ri: 362, ro: 263, nose: 168, fore: 10, chin: 152 };

function glassTintMaterial(tint = "monofocal") {
  // Opacidades con salto visible entre tipos (antes 0.16–0.55, imperceptible).
  let color = 0xcfe0f0, opacity = 0.2;
  switch (lensKind(tint)) {
    case LENS_KIND.SUN: color = 0x232f38; opacity = 0.72; break;
    case LENS_KIND.PHOTOCHROMIC: color = 0x646a76; opacity = 0.55; break;
    case LENS_KIND.BLUE: color = 0xd9a93f; opacity = 0.42; break;
    case LENS_KIND.PROGRESSIVE: color = 0x9dc0e6; opacity = 0.3; break;
    default: break;
  }
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

// Ancho real de la montura en unidades IPD (1.0 = distancia interpupilar).
function glbTargetWidth(frame, metrics) {
  const ipd = Number(metrics?.ipd_mm_est);
  let width = 2.1;
  if (ipd > 0 && Number(frame?.ancho_total_mm) > 0) {
    width = Number(frame.ancho_total_mm) / ipd;
  } else if (ipd > 0 && Number(frame?.A_mm) > 0 && Number(frame?.D_mm) > 0) {
    width = (2 * Number(frame.A_mm) + Number(frame.D_mm)) / ipd;
  }
  return clamp(width, 1.7, 2.6);
}

export function estimatePose(lm) {
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

/**
 * Pose real a partir de la matriz facial 4x4 de MediaPipe (row-major).
 * Es mucho más estable que deducir pitch de la punta de la nariz: en una foto
 * frontal el heurístico daba -22° y hundía las patillas sobre las mejillas.
 * @returns {{yaw:number, pitch:number, roll:number}|null} radianes
 */
export function poseFromMatrix(data) {
  if (!data || data.length < 16) return null;
  const m = new THREE.Matrix4().fromArray(data);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
  if (![e.x, e.y, e.z].every(Number.isFinite)) return null;
  return { yaw: e.y, pitch: e.x, roll: e.z };
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
    this.glbGroups = new Map();
    this.glbToken = 0;
    this.pendingGlbForma = "";
    this.usingGlb = false;
    this.applyEntryScale = true;
  }

  setModel(frame, tint = "monofocal", metrics = null) {
    const key = `${frame?.id ?? frame?.forma ?? "?"}|${tint}|${frame?.color}|${frame?.material}|${metrics?.ipd_mm_est ?? "?"}|${frame?.ancho_total_mm ?? "?"}`;
    if (key === this.key) return;
    this.key = key;
    if (this.group) this._removeGroup(this.group);
    this.group = null;
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

    const forma = frame?.forma || "rectangular";
    const targetWidth = glbTargetWidth(frame, metrics);
    // El `scale` del manifest se calibró contra una guía genérica de la página
    // de ajuste. Cuando hay medidas reales (IPD + ancho total) el ancho ya es
    // físico y aplicarlo encogería la montura ~25 %. Solo se usa como
    // corrección cuando no hay medidas.
    this.applyEntryScale = !(ipd > 0 && Number(frame?.ancho_total_mm) > 0);
    const glbKey = `${forma}|${targetWidth.toFixed(3)}|${tint}|${this.applyEntryScale ? "s" : "n"}`;
    const cachedGlb = this.glbGroups.get(glbKey);
    if (cachedGlb) {
      // El GLB ya está normalizado y cacheado: se reutiliza sin parpadeo.
      this.group = cachedGlb;
      this.usingGlb = true;
      this.scene.add(cachedGlb);
      return;
    }

    // Mientras el GLB carga se muestra el armazón procedural; si falla, se queda.
    this.group = buildGlassesGroup(frame, tint, dims);
    this.usingGlb = false;
    this.scene.add(this.group);
    this._loadGlb(frame, tint, targetWidth, glbKey);
  }

  _loadGlb(frame, tint, targetWidth, glbKey) {
    const forma = frame?.forma || "rectangular";
    const token = ++this.glbToken;
    this.pendingGlbForma = forma;
    loadGlb(forma).then((loaded) => {
      if (!loaded || token !== this.glbToken || this.pendingGlbForma !== forma) return;
      const entryScale = this.applyEntryScale ? (Number(loaded.entry?.scale) || 1) : 1;
      const width = (Number(loaded.entry?.targetWidth) || targetWidth) * entryScale;
      const key = glbKey || `${forma}|${width.toFixed(3)}|${tint}`;
      let group = this.glbGroups.get(key);
      if (!group) {
        group = buildGlbGroup(loaded.gltf.scene, { targetWidth: width, entry: loaded.entry, tint });
        this.glbGroups.set(key, group);
      }
      if (token !== this.glbToken || this.pendingGlbForma !== forma) return;
      const previous = this.group;
      this.group = group;
      this.usingGlb = true;
      this.scene.add(group);
      if (previous && previous !== group) this._removeGroup(previous);
    }).catch(() => {
      // Sin GLB válido se conserva el procedural; no se rompe el try-on.
    });
  }

  _removeGroup(group) {
    if (!group) return;
    this.scene?.remove(group);
    group.traverse((o) => {
      if (o.userData?.sharedGlb) return;
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => m.dispose?.());
    });
  }

  render(lm, cw, ch, poseOverride = null) {
    if (!this.renderer || !this.scene || !this.camera) return null;
    if (!lm || lm.length < 400 || !this.group) return null;
    if (this.canvas.width !== Math.round(cw) || this.canvas.height !== Math.round(ch)) {
      this.canvas.width = Math.round(cw);
      this.canvas.height = Math.round(ch);
    }
    this.renderer.setSize(cw, ch, false);
    this.camera.left = -cw / 2; this.camera.right = cw / 2;
    this.camera.top = ch / 2; this.camera.bottom = -ch / 2;
    this.camera.updateProjectionMatrix();
    // La posición y la escala salen de los landmarks (centro de ojos e IPD en
    // píxeles). La rotación puede venir de la matriz facial de MediaPipe, que
    // es una pose real y no una heurística de la punta de la nariz.
    const base = estimatePose(lm);
    const override = poseOverride?.matrix ? poseFromMatrix(poseOverride.matrix) : poseOverride;
    const pose = override
      ? {
          ...base,
          yaw: Number.isFinite(override.yaw) ? override.yaw : base.yaw,
          pitch: Number.isFinite(override.pitch) ? override.pitch : base.pitch,
          roll: Number.isFinite(override.roll) ? override.roll : base.roll,
        }
      : base;
    const px = pose.cx * cw - cw / 2;
    const py = -(pose.cy * ch - ch / 2);
    this.group.position.set(px, py, 0);
    const s = pose.ipd * cw;
    this.group.scale.setScalar(Math.max(1e-6, s));
    // Orden YXZ: guiño (yaw) + cabeceo (pitch) + giro (roll)
    this.group.rotation.set(pose.pitch, pose.yaw, -pose.roll, "YXZ");
    this.renderer.render(this.scene, this.camera);
    return { yawDeg: pose.yaw * 57.3, pitchDeg: pose.pitch * 57.3, rollDeg: pose.roll * 57.3, ipdPx: pose.ipd * cw, glb: this.usingGlb };
  }

  /**
   * Espera (como máximo `timeoutMs`) a que el GLB esté montado. Sirve al modo
   * foto, que necesita decidir entre 3D y 2D en un solo render.
   */
  whenReady(timeoutMs = 1500) {
    if (this.usingGlb) return Promise.resolve(true);
    const token = this.glbToken;
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (this.usingGlb) return resolve(true);
        if (this.glbToken !== token || performance.now() - start >= timeoutMs) {
          return resolve(this.usingGlb);
        }
        setTimeout(tick, 60);
      };
      tick();
    });
  }

  clear() {
    if (!this.renderer) return;
    // El canvas ya tiene contexto WebGL: getContext("2d") devuelve null.
    // Para limpiarlo hay que usar el renderer y mantener el fondo transparente.
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
  }

  dispose() {
    const seen = new Set();
    if (this.group) {
      this._removeGroup(this.group);
      seen.add(this.group);
      this.group = null;
    }
    for (const group of this.glbGroups.values()) {
      if (!seen.has(group)) this._removeGroup(group);
      seen.add(group);
    }
    this.glbGroups.clear();
    this.glbToken += 1;
    this.pendingGlbForma = "";
    this.usingGlb = false;
    try {
      this.renderer?.dispose?.();
      this.renderer?.forceContextLoss?.();
    } catch { /* noop */ }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.key = "";
  }
}
