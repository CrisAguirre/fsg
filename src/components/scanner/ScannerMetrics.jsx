const FORMAS = ["oval", "redondo", "cuadrado", "corazon", "diamante", "oblongo", "triangular"];

export default function ScannerMetrics({ metrics, loading, onChangeShape }) {
  if (!metrics) return null;

  return (
    <div className="glass scanner__panel scanner__metrics">
      <div className="scanner__metrics-header">
        <h3>🔬 Análisis Morfométrico Facial <span className="tag">orientativo</span></h3>
        <label
          className="scanner__shape-edit"
          title="Si el óptico no coincide con la forma detectada, corrígela aquí y se recalculan las recomendaciones."
        >
          Forma:
          <select
            value={metrics.face_shape}
            onChange={(e) => onChangeShape(e.target.value)}
            disabled={!!loading}
          >
            {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      </div>
      <p className="scanner__sub">
        Forma estimada automáticamente. Si el óptico no coincide, corrígela:
        el sistema recalcula el contraste y las recomendaciones.
      </p>
      <div className="scanner__metrics-grid">
        <div className="metric-chip">
          <span className="metric-label">Índice de Simetría</span>
          <span className="metric-val">{metrics.symmetry_index}%</span>
        </div>
        <div className="metric-chip">
          <span className="metric-label">IPD estimada</span>
          <span className="metric-val">≈ {Number(metrics.ipd_mm_est ?? 0).toFixed(1)} mm</span>
        </div>
        <div className="metric-chip">
          <span className="metric-label">Ancho Facial Estimado</span>
          <span className="metric-val">≈ {Number(metrics.temporal_est ?? 0).toFixed(1)} mm</span>
        </div>
        <div className="metric-chip">
          <span className="metric-label">Puente Nasal Estimado</span>
          <span className="metric-val">≈ {Number(metrics.nose_bridge_mm_est ?? 0).toFixed(1)} mm</span>
        </div>
        <div className="metric-chip">
          <span className="metric-label">Proporción Largo/Ancho</span>
          <span className="metric-val">{Number(metrics.ratios?.largo_ancho ?? 1.3).toFixed(2)}</span>
        </div>
        <div className="metric-chip">
          <span className="metric-label">Zona de Cejas</span>
          <span className="metric-val">{metrics.eyebrow_in_frame_zone ? "Despejada ✓" : "Atención"}</span>
        </div>
      </div>
      <p className="scanner__sub">Valores estimados a partir de una foto 2D. No sustituyen una medición presencial en óptica.</p>
      {metrics.warnings?.map((w) => <p key={w} className="scanner__warning">⚠ {w}</p>)}
    </div>
  );
}
