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
  renderer.toneMappingExposure = 1.02;

  let room = null;
  let pmrem = null;
  try {
    pmrem = new THREE.PMREMGenerator(renderer);
    room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 1;
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
