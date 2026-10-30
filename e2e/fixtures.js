// Monturas de prueba: cubren todos los campos que pinta el catálogo y el modal.
export const FRAMES = [
  {
    id: "F01",
    nombre: "Aurora Rectangular",
    forma: "rectangular",
    marca: "OptiVision",
    genero: "unisex",
    estilo: "casual",
    talla: "M",
    precio_rango: "medio",
    tipo_lente: ["monofocal", "blue-cut"],
    ancho_total_mm: 138,
    A_mm: 52,
    B_mm: 36,
    D_mm: 18,
    patilla_mm: 140,
    material: "Acetato",
    color: "Negro",
    imagen_url: "",
  },
  {
    id: "F02",
    nombre: "Solar Redondo",
    forma: "redondo",
    marca: "Prisma",
    genero: "mujer",
    estilo: "elegante",
    talla: "S",
    precio_rango: "premium",
    tipo_lente: ["polarizado"],
    ancho_total_mm: 132,
    A_mm: 48,
    B_mm: 42,
    D_mm: 20,
    patilla_mm: 145,
    material: "Metal",
    color: "Dorado",
    imagen_url: "",
  },
];

/** Mockea los endpoints que consume el front en las páginas bajo prueba. */
export async function mockApi(page) {
  await page.route("**/api/health", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/frames", (route) => route.fulfill({ json: FRAMES }));
  await page.route("**/api/analyze", (route) => route.fulfill({ json: METRICS }));
  await page.route("**/api/recommend", (route) => route.fulfill({ json: RECS }));
}

/** Respuesta mínima de `POST /analyze` para el flujo foto → recomendación. */
export const METRICS = {
  face_detected: true,
  face_shape: "oval",
  symmetry_index: 91,
  ratios: { largo_ancho: 1.3, frente_pomulo: 0.95, mandibula_frente: 0.9 },
  ipd_mm_est: 63,
  nose_bridge_mm_est: 18,
  temporal_est: 139,
  eyebrow_in_frame_zone: true,
  warnings: [],
};

/** Respuesta mínima de `POST /recommend`, ordenada por score. */
export const RECS = [
  {
    frame_id: "F01",
    score: 88,
    verdict: "compatible",
    reasons: ["Proporción compatible", "Centrado óptico correcto", "Apoyo nasal adecuado"],
  },
  {
    frame_id: "F02",
    score: 61,
    verdict: "parcial",
    reasons: ["Forma parcialmente compatible", "Revisar altura del lente", "Apoyo nasal ajustado"],
  },
];
