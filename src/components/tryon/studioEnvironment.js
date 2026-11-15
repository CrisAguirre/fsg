// Iluminación de estudio compartida por el probador 3D y el render estático.
// Un environment map PMREM da reflejos reales a metales y acetatos; el tone
// mapping ACES evita que los brillos del entorno quemen el color del armazón.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * Configura el renderer y la escena con un entorno neutro de estudio.
 * @returns {THREE.WebGLRenderTarget|null} target del PMREM para liberarlo al final
 */
export function setupStudioEnvironment(renderer, scene) {
  if (!renderer || !scene) return null;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  let room = null;
  let pmrem = null;
  try {
    pmrem = new THREE.PMREMGenerator(renderer);
    room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    // El IBL aporta reflejos, no la luz principal: por encima de ~0.7 la luz
    // difusa del entorno lava los acetatos y el carey se lee anaranjado.
    scene.environmentIntensity = 0.65;
    return target;
  } catch {
    // Sin WebGL2/PMREM el probador conserva las luces direccionales.
    return null;
  } finally {
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2c3442, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(1.5, 2, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.32);
  fill.position.set(-2, -1, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(-2, 2, -4);
  scene.add(rim);
}
