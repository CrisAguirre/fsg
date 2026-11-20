// Iluminación de estudio compartida por el probador 3D y el render estático.
// Un environment map PMREM da reflejos reales a metales y acetatos; el tone
// mapping ACES evita que los brillos del entorno quemen el color del armazón.
//
// El entorno se construye con softboxes (paneles emisivos) en vez de depender
// solo de `RoomEnvironment`: así el acetato y el metal cepillado reciben
// reflejos alargados y direccionales, que es lo que hace que una montura se
// lea como un objeto real y no como un plástico plano.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { setTextureAnisotropy } from "./surfaceTextures.js";

/** Escena de estudio: caja oscura + softboxes cálidos/fríos. */
function buildStudioScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d12);

  const panel = (w, h, color, intensity, pos, rot) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    scene.add(mesh);
    return mesh;
  };

  // Softbox superior: el reflejo largo que recorre el puente y las patillas.
  panel(6.5, 2.2, 0xffffff, 4.2, [0, 4.4, 0.2], [-Math.PI / 2, 0, 0]);
  // Lateral frío (relleno).
  panel(2.6, 4.4, 0xbcd4ff, 2.1, [-4.4, 0.6, 0.4], [0, Math.PI / 2, 0]);
  // Lateral cálido (key suave).
  panel(2.6, 4.4, 0xfff1d6, 2.4, [4.4, 0.6, 0.4], [0, -Math.PI / 2, 0]);
  // Frontal muy tenue: evita que el frente quede completamente negro.
  panel(4.4, 2.6, 0xffffff, 0.85, [0, 0.4, 5.2], [0, 0, 0]);
  // Piso oscuro: los reflejos inferiores no rebotan blanco puro.
  panel(14, 14, 0x05070a, 1, [0, -3.2, 0], [-Math.PI / 2, 0, 0]);

  return scene;
}

function disposeScene(scene) {
  if (!scene) return;
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m?.dispose?.());
    }
  });
  scene.clear?.();
}

/**
 * Configura el renderer y la escena con un entorno neutro de estudio.
 * @returns {THREE.WebGLRenderTarget|null} target del PMREM para liberarlo al final
 */
export function setupStudioEnvironment(renderer, scene) {
  if (!renderer || !scene) return null;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);

  try {
    setTextureAnisotropy(renderer.capabilities?.getMaxAnisotropy?.() ?? 4);
  } catch {
    /* capabilities no disponible: se conserva el valor por defecto */
  }

  let pmrem = null;
  let studio = null;
  let room = null;
  try {
    pmrem = new THREE.PMREMGenerator(renderer);
    studio = buildStudioScene();
    const target = pmrem.fromScene(studio, 0.02);
    scene.environment = target.texture;
    // El IBL aporta reflejos y micro-contraste, no la luz difusa principal:
    // por encima de ~0.9 los acetatos se lavan y el carey se lee anaranjado.
    scene.environmentIntensity = 0.8;
    return target;
  } catch {
    // Sin WebGL2/PMREM se intenta el entorno neutro de Three.js; si también
    // falla, el probador conserva las luces direccionales.
    try {
      pmrem?.dispose?.();
      pmrem = new THREE.PMREMGenerator(renderer);
      room = new RoomEnvironment();
      const target = pmrem.fromScene(room, 0.04);
      scene.environment = target.texture;
      scene.environmentIntensity = 0.65;
      return target;
    } catch {
      return null;
    }
  } finally {
    disposeScene(studio);
    room?.dispose?.();
    pmrem?.dispose?.();
  }
}

/** Libera el entorno y deja la escena sin referencias al render target. */
export function disposeStudioEnvironment(scene, target) {
  if (scene) scene.environment = null;
  target?.dispose?.();
}

/**
 * Luces de estudio compartidas por el probador en vivo y el render estático.
 * La key es neutra (no cálida) para no virar el carey a naranja; el relleno azul
 * separa el armazón del rostro y el rim marca el borde superior.
 */
export function addStudioLights(scene) {
  if (!scene) return;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2c3442, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(1.8, 2.4, 4.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.38);
  fill.position.set(-2.2, -1, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.62);
  rim.position.set(-2.4, 2.4, -4);
  scene.add(rim);
  // Luz de rebote inferior: separa la montura de la mejilla sin aplanarla.
  const bounce = new THREE.DirectionalLight(0xffe9d2, 0.12);
  bounce.position.set(0, -2.5, 2.5);
  scene.add(bounce);
}
