// Fuente única de color del armazón y clasificación de tintes para los tres
// motores de try-on: procedural 2D (GlassesOverlay), 3D (Frame3D) y GLB
// (GlassesGLB). Cada motor conserva su propia opacidad y formato de salida.

// Color real del catálogo (nombres en español) → hex para render fotorrealista.
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

// Muestras de tinte usadas por la UI del escáner y por el motor 3D.
export const LENS_SWATCH = {
  monofocal: "#cfe0f0",
  "blue-cut": "#d9a93f",
  "fotocromático": "#646a76",
  polarizado: "#232f38",
  bifocal: "#9dc0e6",
  progresivo: "#9dc0e6",
};

export const LENS_KIND = {
  CLEAR: "clear",
  SUN: "sun",
  PHOTOCHROMIC: "photochromic",
  BLUE: "blue",
  PROGRESSIVE: "progressive",
};

/**
 * Normaliza el nombre de un lente a una familia de tinte.
 * Evita repetir la cadena de `includes()` en cada motor.
 */
export function lensKind(tint = "monofocal") {
  const t = String(tint || "monofocal").toLowerCase();
  if (t.includes("polarizado") || t.includes("sol")) return LENS_KIND.SUN;
  if (t.includes("fotocrom")) return LENS_KIND.PHOTOCHROMIC;
  if (t.includes("blue")) return LENS_KIND.BLUE;
  if (t.includes("progresivo") || t.includes("bifocal")) return LENS_KIND.PROGRESSIVE;
  return LENS_KIND.CLEAR;
}
