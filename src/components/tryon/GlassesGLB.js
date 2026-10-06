// Try-on 3D fotorrealista (v1.1).
// Si existe /glasses/<forma>.glb en public, lo renderiza escalado por IPD;
// si no, devuelve false y el Scanner usa el procedural (GlassesOverlay).
// Uso: const ok = await renderGLB(canvas, { forma, ipdPx }) — sin bloquear.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const cache = new Map();

export async function glbDisponible(forma) {
  try {
    const r = await fetch(`/glasses/${forma}.glb`, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function renderGLB(canvas, { forma = "rectangular", ipdPx = 100 } = {}) {
  if (!(await glbDisponible(forma))) return false;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const W = canvas.clientWidth || 640, H = canvas.clientHeight || 480;
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
  cam.position.set(0, 0, 3.2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.4));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(1.5, 2, 3);
  scene.add(dir);
  let gltf = cache.get(forma);
  if (!gltf) {
    const loader = new GLTFLoader();
    gltf = await loader.loadAsync(`/glasses/${forma}.glb`);
    cache.set(forma, gltf);
  }
  const model = gltf.scene.clone();
  // Normaliza: el modelo debe medir ~1 unidad de sien a sien; se escala por IPD real.
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = (ipdPx / 100) / Math.max(size.x, 1e-6);
  model.scale.setScalar(s * 1.0);
  box.setFromObject(model);
  const c = new THREE.Vector3();
  box.getCenter(c);
  model.position.sub(c); // centra en origen = puente nasal
  scene.add(model);
  renderer.render(scene, cam);
  renderer.dispose();
  return true;
}
