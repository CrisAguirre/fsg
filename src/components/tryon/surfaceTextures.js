// Micro-texturas procedurales para las monturas 3D.
//
// La mayoría de los GLB del catálogo solo traen color plano (sin mapas de
// normal ni rugosidad), así que el armazón se veía como plástico liso. Este
// módulo genera una vez por acabado un juego de texturas PBR (color, normal y
// rugosidad) con el detalle superficial real de cada material:
//
//   - acetato: grano fino y una veta muy tenue.
//   - carey: vetas tipo tortuga sobre el color del catálogo.
//   - metal: cepillado direccional (rayas finas).
//   - mate: micro-grano uniforme.
//   - cristal: casi liso, solo una ondulación mínima.
//
// Las texturas se comparten entre materiales y se cachean por acabado. No se
// liberan al desmontar el probador: viven durante toda la sesión.
import * as THREE from "three";

const SIZE = 256;
const cache = new Map();
let anisotropy = 4;

/** Ajusta el filtrado anisotrópico de todas las texturas ya generadas. */
export function setTextureAnisotropy(value) {
  const next = Math.max(1, Math.min(16, Math.round(Number(value) || 4)));
  if (next === anisotropy) return;
  anisotropy = next;
  for (const entry of cache.values()) {
    for (const tex of [entry.colorMap, entry.normalMap, entry.roughnessMap, entry.clearcoatNormalMap]) {
      if (tex) tex.anisotropy = anisotropy;
    }
  }
}

function rand(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = rand(xi, yi, seed);
  const b = rand(xi + 1, yi, seed);
  const c = rand(xi, yi + 1, seed);
  const d = rand(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x, y, seed, octaves = 3) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * smoothNoise(x * freq, y * freq, seed + i * 7);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return norm > 0 ? sum / norm : 0;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}

function makeTexture(data, { repeat = 2, srgb = false } = {}) {
  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = anisotropy;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildNormal(height, strength) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const i = y * SIZE + x;
      const left = height[y * SIZE + ((x - 1 + SIZE) % SIZE)];
      const right = height[y * SIZE + ((x + 1) % SIZE)];
      const up = height[((y - 1 + SIZE) % SIZE) * SIZE + x];
      const down = height[((y + 1) % SIZE) * SIZE + x];
      let nx = (left - right) * strength;
      let ny = (down - up) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const o = i * 4;
      data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  return data;
}

function buildFinish(finish) {
  const color = new Uint8Array(SIZE * SIZE * 4);
  const rough = new Uint8Array(SIZE * SIZE * 4);
  const height = new Float32Array(SIZE * SIZE);
  const isMetal = finish === "metal" || finish === "mixed";
  const isCarey = finish === "carey";
  const isMatte = finish === "matte";
  const isGlass = finish === "transparent";
  const seed = { metal: 11, mixed: 13, carey: 23, matte: 31, transparent: 41, acetate: 17 }[finish] ?? 17;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const u = x / SIZE;
      const v = y / SIZE;
      let h;
      let r;
      let cr;
      let cg;
      let cb;

      if (isMetal) {
        // Cepillado: ruido muy estirado en X (rayas horizontales finas).
        const brushed = smoothNoise(u * 6, v * 210, seed) * 0.65
          + smoothNoise(u * 38, v * 340, seed + 1) * 0.35;
        h = brushed;
        const c = 0.94 + (brushed - 0.5) * 0.12;
        cr = c; cg = c; cb = c;
        // Modula el roughness del perfil sin convertir un metal cepillado en espejo.
        r = 0.92 + (brushed - 0.5) * 0.18;
      } else if (isCarey) {
        // Carey orgánico: manchas translúcidas ámbar cálido y vetas oscuras profundas.
        const warpX = fbm(u * 2.2, v * 2.2, seed + 5, 2) * 0.45;
        const warpY = fbm(u * 2.2, v * 2.2, seed + 9, 2) * 0.45;
        const veins = fbm((u + warpX) * 3.4, (v + warpY) * 2.6, seed, 4);
        const flecks = fbm(u * 7.5, v * 6.0, seed + 11, 3);
        const darkSpot = smoothstep(0.46, 0.68, veins * 0.78 + flecks * 0.22);
        const amberSpot = 1 - smoothstep(0.28, 0.5, veins);
        const grain = smoothNoise(u * 90, v * 90, seed + 2);
        h = darkSpot * 0.25 + grain * 0.2;
        // Tonos miel/ámbar cálido en zonas claras y espresso profundo en vetas.
        cr = (0.98 + amberSpot * 0.02 - darkSpot * 0.66) - (grain - 0.5) * 0.03;
        cg = (0.76 + amberSpot * 0.14 - darkSpot * 0.57) - (grain - 0.5) * 0.03;
        cb = (0.48 + amberSpot * 0.12 - darkSpot * 0.39) - (grain - 0.5) * 0.02;
        r = 0.92 + darkSpot * 0.06 + (grain - 0.5) * 0.04;
      } else if (isMatte) {
        const grain = fbm(u * 78, v * 78, seed, 2);
        h = grain * 0.8;
        const c = 0.95 + (grain - 0.5) * 0.06;
        cr = c; cg = c; cb = c;
        r = 0.97 + (grain - 0.5) * 0.05;
      } else if (isGlass) {
        const grain = smoothNoise(u * 55, v * 55, seed);
        h = grain * 0.25;
        const c = 0.995 - (grain - 0.5) * 0.015;
        cr = c; cg = c; cb = c;
        r = 0.9 + (grain - 0.5) * 0.05;
      } else {
        // Acetato pulido: veta laminar muy sutil sin grano áspero de plástico.
        const grain = fbm(u * 85, v * 85, seed, 2);
        const flow = smoothNoise(u * 3.5, v * 14, seed + 3);
        h = grain * 0.35 + flow * 0.45;
        const c = 0.96 + (grain - 0.5) * 0.035 + (flow - 0.5) * 0.04;
        cr = c; cg = c; cb = c;
        r = 0.93 + (flow - 0.5) * 0.07 + (grain - 0.5) * 0.04;
      }

      const i = (y * SIZE + x) * 4;
      const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
      color[i] = clampByte(cr);
      color[i + 1] = clampByte(cg);
      color[i + 2] = clampByte(cb);
      color[i + 3] = 255;
      const rr = clampByte(r);
      rough[i] = rr;
      rough[i + 1] = rr;
      rough[i + 2] = rr;
      rough[i + 3] = 255;
      height[y * SIZE + x] = h;
    }
  }

  const strength = isMetal ? 2.8 : isCarey ? 1.1 : isMatte ? 1.3 : isGlass ? 0.6 : 0.95;
  const normal = buildNormal(height, strength);
  const repeat = isMetal ? 2 : 2;
  return {
    colorMap: makeTexture(color, { repeat, srgb: true }),
    normalMap: makeTexture(normal, { repeat }),
    roughnessMap: makeTexture(rough, { repeat }),
    clearcoatNormalMap: makeTexture(normal, { repeat: repeat * 2 }),
    normalScale: isMetal ? 0.26 : isCarey ? 0.11 : isMatte ? 0.13 : isGlass ? 0.04 : 0.09,
    clearcoatNormalScale: isGlass ? 0.025 : 0.05,
  };
}

/** Texturas cacheadas de un acabado (`acetate`, `carey`, `metal`, …). */
export function getSurfaceTextures(finish = "acetate") {
  const key = String(finish || "acetate");
  if (!cache.has(key)) cache.set(key, buildFinish(key));
  return cache.get(key);
}

/**
 * Aplica detalle superficial a un material de armazón. Respeta los mapas que
 * ya traiga el GLB (p. ej. el cepillado horneado de `redondo`) y solo rellena
 * los que falten. `forceMap` reemplaza el color base por la veta procedural.
 */
export function applySurfaceDetail(material, profile = {}, { forceMap = false } = {}) {
  if (!material) return material;
  const finish = profile.finish || "acetate";
  const surface = getSurfaceTextures(finish);

  if (forceMap || !material.map) material.map = surface.colorMap;
  if (!material.normalMap) {
    material.normalMap = surface.normalMap;
    material.normalScale = new THREE.Vector2(surface.normalScale, surface.normalScale);
  }
  if (!material.roughnessMap) material.roughnessMap = surface.roughnessMap;

  if (material.isMeshPhysicalMaterial) {
    if (!material.clearcoatNormalMap) {
      material.clearcoatNormalMap = surface.clearcoatNormalMap;
      material.clearcoatNormalScale = new THREE.Vector2(
        surface.clearcoatNormalScale,
        surface.clearcoatNormalScale,
      );
    }
    material.ior = 1.5;
    material.specularIntensity = finish === "matte" ? 0.35 : 0.85;
    material.specularColor = new THREE.Color(0xffffff);
    if (finish === "acetate" || finish === "carey") {
      // Laca de acetato pulido: un sheen cálido sutil en los bordes rasantes.
      material.sheen = 0.12;
      material.sheenRoughness = 0.6;
      material.sheenColor = new THREE.Color(0xfff4e6);
    }
    if (finish === "metal" || finish === "mixed") {
      // Reflejos alargados en el metal cepillado.
      material.anisotropy = 0.72;
      material.anisotropyRotation = 0;
    }
  }

  material.needsUpdate = true;
  return material;
}
