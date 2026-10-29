import { lensCompatibility } from "../../lib/lensCompatibility.js";

export default function RecommendationCard({ rec, frame, isSelected, onSelect }) {
  const lenses = lensCompatibility(frame, rec.score);

  return (
    <div className={`glass scanner__card verdict--${rec.verdict} ${isSelected ? "scanner__card--selected" : ""}`}>
      <div className="scanner__card-top">
        <span className={`badge-verdict verdict-badge--${rec.verdict}`}>
          {rec.verdict === "compatible" ? "✓ Compatible" : rec.verdict === "parcial" ? "~ Parcial" : "✕ Incompatible"}
        </span>
        <span className="scanner__card-score">{rec.score} pts</span>
      </div>

      <div className="scanner__card-img-wrap">
        <img
          src={frame?.imagen_url || `/frames/${frame?.forma || "rectangular"}.jpg`}
          alt={frame?.nombre || "Montura"}
          className="scanner__card-img"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      </div>

      <h4 className="scanner__card-title">{frame?.nombre ?? rec.frame_id}</h4>
      <div className="scanner__card-meta">
        <span className="tag">{frame?.forma}</span>
        <span className="tag">{frame?.marca ?? "OptiVision"}</span>
        <span className="tag tag--highlight">{frame?.estilo}</span>
        <span className="tag">Talla {frame?.talla ?? "M"}</span>
        {frame?.precio_rango && <span className="tag tag--price">{frame.precio_rango}</span>}
      </div>

      <div className="scanner__card-specs">
        <span>Calibre A: <b>{frame?.A_mm}mm</b></span>
        <span>Alto B: <b>{frame?.B_mm}mm</b></span>
        <span>Puente D: <b>{frame?.D_mm}mm</b></span>
        <span>Total: <b>{frame?.ancho_total_mm}mm</b></span>
      </div>

      {lenses.length > 0 && (
        <div className="scanner__card-lentes">
          <small>Lentes para tu rostro en esta montura:</small>
          <div className="lentes-tags">
            {lenses.map((l) => (
              <button
                key={l.tipo}
                type="button"
                title={`${l.motivo} Clic para montar este modelo + lente.`}
                onClick={() => onSelect(l.tipo)}
                className={`lente-tag lente--${l.estado}`}
              >
                {l.estado === "compatible" ? "✓" : l.estado === "parcial" ? "~" : "✕"} {l.tipo} {l.prob}%
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="scanner__card-reasons">
        {rec.reasons.map((x) => <li key={x}>{x}</li>)}
      </ul>

      <button
        className={`btn btn--sm ${isSelected ? "btn--primary" : "btn--glass"} scanner__card-btn`}
        onClick={() => onSelect()}
      >
        {isSelected ? "👓 Probando ahora" : "👓 Probar en probador virtual"}
      </button>
    </div>
  );
}
