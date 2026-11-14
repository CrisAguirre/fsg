// Carga y normaliza los GLB por forma para el probador.
// El manifest (/glasses/manifest.json) define archivo, rotación, offset vertical
// y qué materiales son cristales. Si no hay manifest, se intenta <forma>.glb.
// El grupo devuelto tiene transform identidad en la raíz para que GlassesAR
// pueda aplicarle la pose de la cabeza sin perder la normalización interna.
import * as THREE from "three";
import { lensKind, LENS_KIND } from "./frameStyle.js";
import { lensPreset, mixLensColor } from "./lensStyle.js";

const MANIFEST_URL = "/glasses/manifest.json";
const DEFAULT_WIDTH = 2.1; // ancho total de montura en unidades IPD

let manifestPromise = null;
const gltfCache = new Map();

const deg = (v) => (Number(v) || 0) * Math.PI / 180;

export async function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL, { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return manifestPromise;
}

/**
 * @typedef {Object} GlbEntry
 * @property {string} forma
 * @property {string} url
 * @property {number[]} rot
 * @property {number} y
 * @property {number|null} targetWidth
 * @property {number} scale
 * @property {string[]} lensMaterials
 * @property {number} lensOpacity
 * @property {string[]} frameMaterials
 * @property {string} frameColor
 * @property {string} source
 * @property {string} title
 * @property {string} author
 * @property {string} author_url
 * @property {string} source_url
 * @property {string} license
 * @property {string} license_url
 */

function normalizeEntry(forma, raw) {
  if (!raw) return null;
  const file = String(raw.file || `${forma}.glb`);
  return {
    forma,
    url: file.startsWith("/") ? file : `/glasses/${file}`,
    rot: Array.isArray(raw.rot) ? raw.rot : [0, 0, 0],
    y: Number(raw.y) || 0,
    targetWidth: Number(raw.targetWidth) || null,
    scale: Number(raw.scale) || 1,
    lensMaterials: Array.isArray(raw.lensMaterials) ? raw.lensMaterials.map(String) : [],
    lensOpacity: raw.lensOpacity != null ? Number(raw.lensOpacity) : 0.16,
    frameMaterials: Array.isArray(raw.frameMaterials) ? raw.frameMaterials.map(String) : [],
    frameColor: raw.frameColor || "",
    source: raw.source || "",
    title: raw.title || "",
    author: raw.author || "",
    author_url: raw.author_url || "",
    source_url: raw.source_url || "",
    license: raw.license || "",
    license_url: raw.license_url || "",
  };
}

export async function getGlbEntry(forma) {
  if (!forma) return null;
  const manifest = await loadManifest();
  const raw = manifest?.[forma];
  if (raw) return normalizeEntry(forma, raw);
  // Compatibilidad con la convención anterior: public/glasses/<forma>.glb.
  // Solo se prueba si el manifest no tiene ninguna forma declarada.
  const forms = Object.keys(manifest || {}).filter((k) => !k.startsWith("_"));
  if (forms.length) return null;
  const url = `/glasses/${forma}.glb`;
  try {
    const r = await fetch(url, { method: "HEAD" });
    if (r.ok) {
      return normalizeEntry(forma, { file: `${forma}.glb` });
    }
  } catch { /* sin red: fallback procedural */ }
  return null;
}

export async function glbDisponible(forma) {
  return !!(await getGlbEntry(forma));
}

/**
 * Carga (con caché) el GLB de una forma.
 * @param {string} [forma]
 * @returns {Promise<null|{gltf: import("three/addons/loaders/GLTFLoader.js").GLTF, entry: GlbEntry}>}
 */
export async function loadGlb(forma) {
  if (!forma) return null;
  if (gltfCache.has(forma)) return gltfCache.get(forma);
  const p = (async () => {
    const entry = await getGlbEntry(forma);
    if (!entry) return null;
    // Import dinámico: GLTFLoader queda en un chunk aparte del bundle del Scanner.
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(entry.url);
    return { gltf, entry };
  })();
  gltfCache.set(forma, p);
  try {
    return await p;
  } catch (err) {
    gltfCache.delete(forma);
    throw err;
  }
}

function lensTint(tint, baseOpacity) {
  const preset = lensPreset(tint);
  const color = new THREE.Color(mixLensColor(preset.color, preset.intensity));
  switch (lensKind(tint)) {
    case LENS_KIND.SUN:
    case LENS_KIND.PHOTOCHROMIC:
    case LENS_KIND.BLUE:
    case LENS_KIND.PROGRESSIVE:
      return { color: color.getHex(), opacity: preset.opacity };
    default:
      return { color: color.getHex(), opacity: baseOpacity };
  }
}

function applyLensTint(root, entry, tint) {
  const wanted = new Set(entry?.lensMaterials || []);
  if (!wanted.size) return;
  const { color, opacity } = lensTint(tint, entry.lensOpacity);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    let changed = false;
    const next = mats.map((m) => {
      if (!m || !wanted.has(m.name)) return m;
      const c = m.clone();
      c.color?.setHex(color);
      // El texture horneado suele ser oscuro o un reflejo fijo: se quita para
      // que el tinte del probador mande y el cristal quede limpio.
      c.map = null;
      c.alphaMap = null;
      c.transparent = true;
      c.opacity = opacity;
      c.depthWrite = false;
      c.needsUpdate = true;
      changed = true;
      return c;
    });
    if (changed) o.material = Array.isArray(o.material) ? next : next[0];
  });
}

function applyFrameTint(root, entry) {
  const wanted = new Set(entry?.frameMaterials || []);
  if (!wanted.size || !entry?.frameColor) return;
  const color = new THREE.Color(entry.frameColor);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    let changed = false;
    const next = mats.map((m) => {
      if (!m || !wanted.has(m.name)) return m;
      const c = m.clone();
      c.color?.copy(color);
      if ("metalness" in c) c.metalness = 0.8;
      if ("roughness" in c) c.roughness = 0.35;
      c.needsUpdate = true;
      changed = true;
      return c;
    });
    if (changed) o.material = Array.isArray(o.material) ? next : next[0];
  });
}

/** Meshes cuyos materiales están declarados como cristal en el manifest. */
function findLensMeshes(root, entry) {
  const wanted = new Set(entry?.lensMaterials || []);
  if (!wanted.size) return [];
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && wanted.has(m.name))) meshes.push(o);
  });
  return meshes;
}

/**
 * Caja de un conjunto de mallas en el espacio local de `root`.
 * `Box3.setFromObject` incluye hijos; las mallas de cristal no los tienen.
 */
function boxOfMeshes(meshes) {
  const box = new THREE.Box3();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    box.union(new THREE.Box3().setFromObject(mesh));
  }
  return box;
}

/**
 * Algunos GLB declaran como cristal tornillos o bordes pequeños. Si entran en
 * la caja de centrado, desplazan la montura. Se conservan las superficies que
 * miden al menos el 40 % del cristal más ancho.
 */
function mainLensMeshes(meshes) {
  if (meshes.length < 2) return meshes;
  const widths = meshes.map((mesh) => {
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    return box.isEmpty() ? 0 : box.max.x - box.min.x;
  });
  const max = Math.max(...widths);
  if (!(max > 0)) return meshes;
  return meshes.filter((_, i) => widths[i] >= max * 0.4);
}

/**
 * Construye un grupo listo para GlassesAR:
 * raíz con transform identidad, hijo normalizado a `targetWidth` unidades IPD.
 */
export function buildGlbGroup(scene, { targetWidth = DEFAULT_WIDTH, entry = null, tint = "monofocal" } = {}) {
  const model = scene.clone(true);
  model.traverse((o) => {
    if (o.isCamera || o.isLight) o.visible = false;
    if (o.isMesh) o.frustumCulled = false;
  });

  // Centrar el modelo antes de rotarlo para que gire sobre su propio centro.
  const box0 = new THREE.Box3().setFromObject(model);
  if (!box0.isEmpty()) {
    const c0 = box0.getCenter(new THREE.Vector3());
    model.position.sub(c0);
  }

  const inner = new THREE.Group();
  inner.add(model);
  const rot = entry?.rot || [0, 0, 0];
  inner.rotation.set(deg(rot[0]), deg(rot[1]), deg(rot[2]));

  const outer = new THREE.Group();
  outer.add(inner);
  outer.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(outer);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetWidth / Math.max(size.x, 1e-6);
  outer.scale.setScalar(scale);
  outer.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(outer);
  // Centrar por los cristales, no por la caja completa: las patillas y los
  // tornillos pueden desplazar el centro óptico varios píxeles. Si el GLB no
  // declara cristales, se mantiene el centrado por la caja completa.
  const lensMeshes = mainLensMeshes(findLensMeshes(outer, entry));
  const lensBox = lensMeshes.length ? boxOfMeshes(lensMeshes) : null;
  const center = lensBox && !lensBox.isEmpty()
    ? lensBox.getCenter(new THREE.Vector3())
    : box.getCenter(new THREE.Vector3());
  outer.position.x -= center.x;
  outer.position.y -= center.y - (Number(entry?.y) || 0);
  outer.position.z -= box.max.z; // plano frontal en z=0; patillas hacia -z

  applyFrameTint(outer, entry);
  applyLensTint(outer, entry, tint);
  // Marca las mallas de cristal para que GlassesAR pueda ajustar color y
  // opacidad en caliente desde los controles del lente.
  for (const mesh of findLensMeshes(outer, entry)) mesh.userData.isLens = true;
  outer.traverse((o) => {
    if (o instanceof THREE.Mesh) o.userData.sharedGlb = true; // geometría/materiales del caché
  });

  const root = new THREE.Group();
  root.add(outer);
  root.userData.glassesGlb = true;
  return root;
}

/**
 * Render estático heredado (no usa pose facial). Mantiene la API anterior.
 */
export async function renderGLB(canvas, { forma = "rectangular", ipdPx = 100, tint = "monofocal" } = {}) {
  const loaded = await loadGlb(forma);
  if (!loaded) return false;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 480;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 100);
  cam.position.set(0, 0, 10);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.6);
  dir.position.set(1.5, 2, 3);
  scene.add(dir);
  const group = buildGlbGroup(loaded.gltf.scene, { targetWidth: ipdPx, entry: loaded.entry, tint });
  group.position.set(0, 0, 0);
  scene.add(group);
  renderer.render(scene, cam);
  renderer.dispose();
  return true;
}
