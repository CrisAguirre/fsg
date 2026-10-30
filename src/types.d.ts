// Contratos compartidos del probador virtual.
// Se declaran aquí para que `tsc --checkJs` valide los hooks y Scanner sin
// migrar el proyecto a TypeScript.

/** Montura tal como la devuelve `GET /frames`. */
export interface TryFrame {
  id: string;
  nombre: string;
  forma: string;
  marca?: string;
  precio_rango?: string;
  tipo_lente?: string;
  imagen_url?: string;
  [key: string]: unknown;
}

/** Métricas faciales de `POST /analyze`. */
export interface TryMetrics {
  face_detected?: boolean;
  ipd_mm_est?: number;
  ancho_total_mm?: number;
  face_shape?: string;
  symmetry_index?: number;
  temporal_est?: number;
  nose_bridge_mm_est?: number;
  eyebrow_in_frame_zone?: boolean;
  ratios?: {
    largo_ancho?: number;
    frente_pomulo?: number;
    mandibula_frente?: number;
  };
  warnings?: string[];
  [key: string]: unknown;
}

/** Recomendación de `POST /recommend`. */
export interface TryRec {
  frame_id: string;
  score: number;
  verdict: string;
  reasons: string[];
}

/**
 * Estado que Scanner publica para los motores de try-on.
 * Los hooks lo leen en cada frame, por eso vive en un ref.
 */
export interface TryState {
  on: boolean;
  forma: string;
  frame: TryFrame | null;
  metrics: TryMetrics | null;
  alpha: number;
  tint: string;
  use3D: boolean;
}
