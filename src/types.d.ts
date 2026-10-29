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
  ipd_mm_est?: number;
  ancho_total_mm?: number;
  face_shape?: string;
  [key: string]: unknown;
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
