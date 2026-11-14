// Fuente única de color del armazón y clasificación de tintes para los tres
// motores de try-on: procedural 2D (GlassesOverlay), 3D (Frame3D) y GLB
// (GlassesGLB). Cada motor conserva su propia opacidad y formato de salida.

// Color real del catálogo (nombres en español) → hex para render fotorrealista.
export function frameColorHex(name = "") {
  const raw = String(name || "");
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw.toLowerCase();
  const n = raw.toLowerCase();
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

/** true si el color es tan oscuro que un tinte plano no aportaría nada. */
export function isDarkColor(hex = "") {
  const h = String(hex || "").replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  if (!Number.isFinite(n)) return false;
  return Math.max((n >> 16) & 255, (n >> 8) & 255, n & 255) < 70;
}

export const FRAME_FINISH = {
  ACETATE: "acetate",
  METAL: "metal",
  MIXED: "mixed",
  CAREY: "carey",
  TRANSPARENT: "transparent",
  MATTE: "matte",
};

/**
 * Acabado real de la montura a partir del material y del nombre de color del
 * catálogo. Es la fuente única para el 3D, el GLB y el tintado 2D.
 */
export function frameFinish(frame = {}) {
  const color = String(frame?.color || "").toLowerCase();
  if (/cristal|transparente/.test(color)) return FRAME_FINISH.TRANSPARENT;
  if (/carey|habana|miel|tortoise|torto/.test(color)) return FRAME_FINISH.CAREY;
  const material = String(frame?.material || "acetato").toLowerCase();
  if (/mixto/.test(material)) return FRAME_FINISH.MIXED;
  if (/metal|titanio|acero|aluminio/.test(material)) return FRAME_FINISH.METAL;
  if (/mate/.test(color)) return FRAME_FINISH.MATTE;
  return FRAME_FINISH.ACETATE;
}

// Valores PBR por acabado. El clearcoat solo se aplica cuando el material
// admite MeshPhysicalMaterial; así el acetato/carey gana brillo de laca sin
// convertir los metales en plástico.
const FINISH_PROFILE = {
  [FRAME_FINISH.METAL]: {
    metalness: 0.92, roughness: 0.28, clearcoat: 0.12, clearcoatRoughness: 0.24,
    envMapIntensity: 1.2, tintStrength: 0.82,
  },
  [FRAME_FINISH.MIXED]: {
    metalness: 0.62, roughness: 0.32, clearcoat: 0.45, clearcoatRoughness: 0.22,
    envMapIntensity: 1.05, tintStrength: 0.8,
  },
  [FRAME_FINISH.CAREY]: {
    metalness: 0.02, roughness: 0.34, clearcoat: 0.9, clearcoatRoughness: 0.14,
    envMapIntensity: 0.78, tintStrength: 0.9,
  },
  [FRAME_FINISH.TRANSPARENT]: {
    metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
    envMapIntensity: 1.1, tintStrength: 0.45, opacity: 0.82,
  },
  [FRAME_FINISH.MATTE]: {
    metalness: 0.02, roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.45,
    envMapIntensity: 0.5, tintStrength: 0.88,
  },
  [FRAME_FINISH.ACETATE]: {
    metalness: 0.04, roughness: 0.38, clearcoat: 0.72, clearcoatRoughness: 0.18,
    envMapIntensity: 0.72, tintStrength: 0.9,
  },
};

/** Perfil PBR completo (color incluido) para un armazón del catálogo. */
export function frameMaterialProfile(frame = {}) {
  const finish = frameFinish(frame);
  return {
    finish,
    color: frameColorHex(frame?.color),
    ...FINISH_PROFILE[finish],
  };
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
