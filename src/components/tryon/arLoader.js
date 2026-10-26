// Carga diferida de GlassesAR (Frame3D + Three.js).
// Compartida por el try-on en vivo y el de foto para que Three.js quede en un
// chunk separado y no bloquee el primer render del escáner.

let GlassesARClass = null;
let loadPromise = null;

export function loadGlassesAR() {
  if (GlassesARClass) return Promise.resolve(GlassesARClass);
  if (!loadPromise) {
    loadPromise = import("./Frame3D.js")
      .then((mod) => {
        GlassesARClass = mod.GlassesAR;
        return GlassesARClass;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}
