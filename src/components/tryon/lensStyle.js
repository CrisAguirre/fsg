// Estilo de lente configurable por el usuario: color, intensidad del color y
// opacidad (tipo transitions). Es la fuente única para los tres motores de
// try-on (GLB 3D, recorte 2D y vectorial).
import { lensKind, LENS_KIND } from "./frameStyle.js";

// Color base del cristal neutro. La intensidad mezcla este tono con el elegido.
export const NEUTRAL_LENS = "#f2f6ff";

// Paleta rápida para la demo en óptica. El selector libre permite cualquier otro.
export const LENS_COLORS = [
  { id: "gris", label: "Gris", hex: "#4b5563" },
  { id: "ambar", label: "Ámbar", hex: "#c98a1e" },
  { id: "marron", label: "Marrón", hex: "#5b3d1e" },
  { id: "azul", label: "Azul", hex: "#1e4f8a" },
  { id: "verde", label: "Verde", hex: "#2f5f4a" },
  { id: "rosa", label: "Rosa", hex: "#a34a6b" },
  { id: "violeta", label: "Violeta", hex: "#5b4a9e" },
  { id: "negro", label: "Negro", hex: "#111827" },
];

const PRESETS = {
  [LENS_KIND.CLEAR]: { color: "#cfe0f0", intensity: 0.3, opacity: 0.18 },
  [LENS_KIND.SUN]: { color: "#232f38", intensity: 1, opacity: 0.65 },
  [LENS_KIND.PHOTOCHROMIC]: { color: "#646a76", intensity: 1, opacity: 0.5 },
  [LENS_KIND.BLUE]: { color: "#d9a93f", intensity: 1, opacity: 0.32 },
  [LENS_KIND.PROGRESSIVE]: { color: "#9dc0e6", intensity: 0.7, opacity: 0.24 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Preset de los tres controles para un tipo de lente del catálogo. */
export function lensPreset(tint = "monofocal") {
  const preset = PRESETS[lensKind(tint)] || PRESETS[LENS_KIND.CLEAR];
  return { ...preset };
}

/** Normaliza un estilo parcial o inválido usando el preset del tipo de lente. */
export function normalizeLensStyle(style, tint = "monofocal") {
  const base = lensPreset(tint);
  const raw = style && typeof style === "object" ? style : {};
  const color = /^#[0-9a-f]{6}$/i.test(String(raw.color || "")) ? raw.color : base.color;
  const intensity = Number.isFinite(Number(raw.intensity))
    ? clamp(Number(raw.intensity), 0, 1)
    : base.intensity;
  const opacity = Number.isFinite(Number(raw.opacity))
    ? clamp(Number(raw.opacity), 0.02, 0.95)
    : base.opacity;
  return { color, intensity, opacity };
}

export function lensStyleKey(style) {
  const s = normalizeLensStyle(style);
  return `${s.color}|${s.intensity.toFixed(3)}|${s.opacity.toFixed(3)}`;
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const f = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}

/** Mezcla el color neutro con el elegido según la intensidad (0–1). */
export function mixLensColor(color, intensity = 1) {
  const a = hexToRgb(NEUTRAL_LENS);
  const b = hexToRgb(color) || a;
  const t = clamp(Number(intensity) || 0, 0, 1);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

/** Aclara (+) u oscurece (-) un color para el degradado del lente vectorial. */
export function shadeLensColor(hex, delta = 0) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return rgbToHex({ r: c.r + delta, g: c.g + delta, b: c.b + delta });
}

export function lensRgba(hex, alpha) {
  const c = hexToRgb(hex) || hexToRgb(NEUTRAL_LENS);
  return `rgba(${c.r},${c.g},${c.b},${clamp(Number(alpha) || 0, 0, 1).toFixed(3)})`;
}

/**
 * Degradado del cristal vectorial a partir del estilo configurado.
 * La opacidad del slider manda; la luz de la foto solo ajusta un poco.
 */
export function lensGradient(style, light = 0.5, tint = "monofocal") {
  const s = normalizeLensStyle(style, tint);
  const base = mixLensColor(s.color, s.intensity);
  const alpha = clamp(s.opacity + (1 - clamp(light, 0, 1)) * 0.06, 0.02, 1);
  return {
    hi: lensRgba(shadeLensColor(base, 46), alpha * 0.9),
    mid: lensRgba(base, alpha),
    lo: lensRgba(shadeLensColor(base, -38), Math.min(1, alpha * 1.08)),
  };
}
