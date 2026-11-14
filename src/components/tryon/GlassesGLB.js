// Carga y normaliza los GLB por forma para el probador.
// El manifest (/glasses/manifest.json) define archivo, rotación, offset vertical
// y qué materiales son cristales. Si no hay manifest, se intenta <forma>.glb.
// El grupo devuelto tiene transform identidad en la raíz para que GlassesAR
// pueda aplicarle la pose de la cabeza sin perder la normalización interna.
import * as THREE from "three";
import { frameColorHex, frameMaterialProfile, isDarkColor, lensKind, LENS_KIND } from "./frameStyle.js";
import { lensPreset, mixLensColor } from "./lensStyle.js";
import { setupStudioEnvironment, disposeStudioEnvironment } from "./studioEnvironment.js";

const MANIFEST_URL = "/glasses/manifest.json";
const DEFAULT_WIDTH = 2.1; // ancho total de montura en unidades IPD

let manifestPromise = null;
const gltfCache = new Map();
const lumaCache = new Map();

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
 * @property {string} frameMaterial
 * @property {string} frameTint
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
    frameMaterial: raw.frameMaterial || "",
    frameTint: raw.frameTint || "",
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

/**
 * Promedio de luminancia de una textura de color base. Sirve para decidir si
 * el mapa horneado es casi negro: en ese caso el tinte del catálogo no se ve
 * (multiplicar por negro da negro) y conviene reemplazarlo conservando los
 * mapas de normal/rugosidad. Se muestrea 8×8 y se cachea por textura.
 */
function baseMapLuma(texture) {
  const image = texture?.image;
  if (!image || typeof document === "undefined") return null;
  if (lumaCache.has(texture.uuid)) return lumaCache.get(texture.uuid);
  let luma = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, 8, 8);
    const data = ctx.getImageData(0, 0, 8, 8).data;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count += 1;
    }
    if (count) luma = sum / count / 255;
  } catch { /* textura no legible: se conserva el mapa */ }
  lumaCache.set(texture.uuid, luma);
  return luma;
}

/** Convierte un material estándar en físico conservando mapas y color. */
function ensurePhysical(material) {
  if (material.isMeshPhysicalMaterial) return material;
  const physical = new THREE.MeshPhysicalMaterial();
  // copy() de MeshPhysicalMaterial espera props físicas que un estándar no
  // tiene; el copy de MeshStandardMaterial sí copia mapas/color con seguridad.
  THREE.MeshStandardMaterial.prototype.copy.call(physical, material);
  physical.defines = { STANDARD: "", PHYSICAL: "" };
  physical.name = material.name;
  physical.userData = { ...material.userData };
  material.dispose();
  return physical;
}

function shouldDropBaseMap(material, colorHex, darkTarget, forceReplace) {
  if (!material.map || !colorHex) return false;
  if (forceReplace) return true;
  if (darkTarget) return false; // negro sobre negro: el mapa aporta veta
  const luma = baseMapLuma(material.map);
  return luma != null && luma < 0.16;
}

function cloneFrameMaterial(source, profile, colorHex, dropMap) {
  let m = source.clone();
  if (profile.clearcoat >= 0.3) m = ensurePhysical(m);
  if (colorHex && m.color) m.color.set(colorHex);
  if (dropMap) m.map = null;
  if ("metalness" in m) m.metalness = profile.metalness;
  if ("roughness" in m) m.roughness = profile.roughness;
  if ("clearcoat" in m) {
    m.clearcoat = profile.clearcoat;
    m.clearcoatRoughness = profile.clearcoatRoughness;
  }
  if ("envMapIntensity" in m) m.envMapIntensity = profile.envMapIntensity;
  if (profile.opacity != null) {
    m.transparent = true;
    m.opacity = profile.opacity;
  }
  m.userData = { ...m.userData, owned: true };
  m.needsUpdate = true;
  return m;
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
      let c = m.clone();
      c = ensurePhysical(c);
      c.color?.setHex(color);
      // El texture horneado suele ser oscuro o un reflejo fijo: se quita el
      // color base para que mande el tinte, pero se conserva el normal map
      // (micro-ondulación del cristal) y el roughness map.
      c.map = null;
      c.alphaMap = null;
      c.transparent = true;
      c.opacity = opacity;
      c.depthWrite = false;
      if ("metalness" in c) c.metalness = 0;
      if ("roughness" in c) c.roughness = 0.06;
      if ("clearcoat" in c) {
        c.clearcoat = 1;
        c.clearcoatRoughness = 0.04;
      }
      if ("ior" in c) c.ior = 1.5;
      if ("specularIntensity" in c) c.specularIntensity = 1;
      if ("envMapIntensity" in c) c.envMapIntensity = 1.15;
      c.userData = { ...c.userData, owned: true };
      c.needsUpdate = true;
      changed = true;
      return c;
    });
    if (changed) o.material = Array.isArray(o.material) ? next : next[0];
  });
}

/**
 * Aplica color y perfil PBR del catálogo a las mallas del armazón. Si el
 * manifest no declara `frameMaterials`, se tiñen todas las mallas que no sean
 * cristal, plaquetas ni superficies transparentes.
 */
function applyFrameTint(root, entry, frame) {
  const wanted = new Set(entry?.frameMaterials || []);
  const auto = wanted.size === 0;
  const colorHex = frame?.color ? frameColorHex(frame.color) : (entry?.frameColor || "");
  if (!colorHex && !wanted.size) return;
  const profile = frameMaterialProfile(frame || {
    color: entry?.frameColor,
    material: entry?.frameMaterial,
  });
  const darkTarget = colorHex ? isDarkColor(colorHex) : false;
  const forceReplace = entry?.frameTint === "replace";
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    let changed = false;
    const next = mats.map((m) => {
      if (!m) return m;
      if (!auto && !wanted.has(m.name)) return m;
      if (auto && (
        (entry?.lensMaterials || []).includes(m.name)
        || /nose|pad|plaqueta|tornillo|screw/i.test(String(m.name || ""))
        || (m.transparent && (m.opacity ?? 1) < 0.5)
      )) return m;
      const dropMap = shouldDropBaseMap(m, colorHex, darkTarget, forceReplace);
      changed = true;
      return cloneFrameMaterial(m, profile, colorHex, dropMap);
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
export function buildGlbGroup(scene, { targetWidth = DEFAULT_WIDTH, entry = null, tint = "monofocal", frame = null } = {}) {
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

  applyFrameTint(outer, entry, frame);
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
  const env = setupStudioEnvironment(renderer, scene);
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 100);
  cam.position.set(0, 0, 10);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.7));
  const dir = new THREE.DirectionalLight(0xfff4e6, 1.8);
  dir.position.set(1.5, 2, 3);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xbcd2ff, 0.6);
  fill.position.set(-2, -1, 3);
  scene.add(fill);
  const group = buildGlbGroup(loaded.gltf.scene, { targetWidth: ipdPx, entry: loaded.entry, tint });
  group.position.set(0, 0, 0);
  scene.add(group);
  renderer.render(scene, cam);
  disposeStudioEnvironment(scene, env);
  renderer.dispose();
  return true;
}
