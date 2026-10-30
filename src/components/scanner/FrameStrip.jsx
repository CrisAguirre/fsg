/**
 * Tira de monturas recomendadas dentro de la vista del probador.
 * Permite cambiar de armazón sin bajar hasta la cuadrícula de tarjetas.
 *
 * @param {{
 *   recs: import("../../types").TryRec[],
 *   frames: import("../../types").TryFrame[],
 *   tryId: string,
 *   onSelect: (id: string) => void,
 * }} props
 */
export default function FrameStrip({ recs, frames, tryId, onSelect }) {
  if (!recs.length) return null;

  const items = recs
    .map((rec) => ({ rec, frame: frames.find((f) => f.id === rec.frame_id) }))
    .filter((x) => x.frame);

  if (!items.length) return null;

  return (
    <div className="scanner__strip-wrap">
      <div className="scanner__strip-head">
        <b>Monturas compatibles · toca para probar</b>
        <small>{items.length} recomendadas por el motor experto</small>
      </div>
      <div
        className="scanner__strip"
        role="group"
        aria-label="Monturas recomendadas para probar"
      >
        {items.map(({ rec, frame }) => {
          const active = rec.frame_id === tryId;
          const icon =
            rec.verdict === "compatible" ? "✓" : rec.verdict === "parcial" ? "~" : "✕";
          return (
            <button
              key={rec.frame_id}
              type="button"
              aria-pressed={active}
              title={`${frame.nombre} · ${rec.score} pts · ${rec.verdict}`}
              className={`scanner__strip-btn ${active ? "scanner__strip-btn--active" : ""}`}
              onClick={() => onSelect(rec.frame_id)}
            >
              <img
                src={frame.imagen_url || `/frames/${frame.forma || "rectangular"}.jpg`}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
              <span className="scanner__strip-name">{frame.nombre}</span>
              <span className={`scanner__strip-score verdict-text--${rec.verdict}`}>
                {icon} {rec.score} pts
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
