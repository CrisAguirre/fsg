const FORMA_LABEL = {
  oval: "Ovalado",
  redondo: "Redondo",
  cuadrado: "Cuadrado",
  corazon: "Corazón",
  diamante: "Diamante",
  oblongo: "Oblongo",
  triangular: "Triangular",
};

const forma = (value) => FORMA_LABEL[value] || value || "—";
const mm = (value) => `${Number(value ?? 0).toFixed(1)} mm`;
const num = (value, digits = 2) => Number(value ?? 0).toFixed(digits);

/**
 * Registro visible del escaneo: forma de cara, métricas y recomendación.
 * Se genera en el cliente y se puede descargar como JSON (no se envía a ningún
 * servidor ni se guarda la foto).
 *
 * @param {{
 *   metrics: import("../../types").TryMetrics | null,
 *   detectedShape?: string,
 *   scanMeta: { at: string, source: string } | null,
 *   top?: import("../../types").TryRec | null,
 *   frame?: import("../../types").TryFrame | null,
 * }} props
 */
export default function ScanRecord({ metrics, detectedShape, scanMeta, top, frame }) {
  if (!metrics || !scanMeta) return null;

  const rows = [
    ["Fecha y hora", new Date(scanMeta.at).toLocaleString("es-CO")],
    ["Origen", scanMeta.source],
    ["Forma detectada", forma(detectedShape || metrics.face_shape)],
    ["Forma confirmada", forma(metrics.face_shape)],
    ["Índice de simetría", `${Number(metrics.symmetry_index ?? 0).toFixed(0)} %`],
    ["IPD estimada", mm(metrics.ipd_mm_est)],
    ["Ancho temporal estimado", mm(metrics.temporal_est)],
    ["Puente nasal estimado", mm(metrics.nose_bridge_mm_est)],
    ["Largo / ancho", num(metrics.ratios?.largo_ancho)],
    ["Frente / pómulo", num(metrics.ratios?.frente_pomulo)],
    ["Mandíbula / frente", num(metrics.ratios?.mandibula_frente)],
    [
      "Zona de cejas",
      metrics.eyebrow_in_frame_zone ? "Despejada ✓" : "Requiere atención",
    ],
  ];

  const record = {
    registro: "escaneo_facial",
    fecha: scanMeta.at,
    origen: scanMeta.source,
    forma_detectada: detectedShape || metrics.face_shape,
    forma_confirmada: metrics.face_shape,
    simetria: metrics.symmetry_index,
    ipd_mm: metrics.ipd_mm_est,
    ancho_temporal_mm: metrics.temporal_est,
    puente_nasal_mm: metrics.nose_bridge_mm_est,
    proporciones: metrics.ratios ?? null,
    zona_cejas: metrics.eyebrow_in_frame_zone,
    advertencias: metrics.warnings ?? [],
    top_recomendacion: top
      ? { frame_id: top.frame_id, score: top.score, verdict: top.verdict }
      : null,
    montura_probada: frame
      ? {
          id: frame.id,
          nombre: frame.nombre,
          forma: frame.forma,
          A_mm: frame.A_mm,
          B_mm: frame.B_mm,
          D_mm: frame.D_mm,
          ancho_total_mm: frame.ancho_total_mm,
        }
      : null,
  };

  function download() {
    try {
      const blob = new Blob([JSON.stringify(record, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `registro-escaneo-${scanMeta.at.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      /* descarga no disponible: el registro sigue visible en pantalla */
    }
  }

  return (
    <section className="glass scanner__record" aria-labelledby="scan-record-title">
      <div className="scanner__record-head">
        <h3 id="scan-record-title">📋 Registro del escaneo</h3>
        <button
          type="button"
          className="btn btn--glass btn--sm"
          onClick={download}
          title="Descargar este registro como JSON"
        >
          ⬇ JSON
        </button>
      </div>
      <dl className="scanner__record-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="scanner__record-item">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {top && (
        <p className="scanner__sub">
          Top recomendación: <b>{frame?.nombre ?? top.frame_id}</b> · {top.score} pts ·{" "}
          {top.verdict}
        </p>
      )}
    </section>
  );
}
