import LenteDot from "./LenteDot.jsx";
import { lensCompatibility } from "../../lib/lensCompatibility.js";

export default function TryOnDetail({ frame, recs, tryId, metrics, tryLens, onSelectLens }) {
  if (!frame) return null;

  const selRec = recs.find((r) => r.frame_id === tryId) ?? null;
  const lenses = lensCompatibility(frame, selRec?.score ?? null);
  const rank = recs.findIndex((r) => r.frame_id === tryId);

  return (
    <div className="scanner__trydetail">
      <div className="scanner__trydetail-top">
        <b>Probando: {frame.nombre}</b>
        <span className="tag">{frame.forma}</span>
        <span className="tag">{frame.material} · {frame.color}</span>
        {selRec && (
          <span className={`badge-verdict verdict-badge--${selRec.verdict}`}>
            {selRec.verdict === "compatible" ? "✓" : selRec.verdict === "parcial" ? "~" : "✕"} {selRec.score}pts · {selRec.verdict}
          </span>
        )}
      </div>
      <small className="scanner__sub">
        A {frame.A_mm}mm · B {frame.B_mm}mm · D {frame.D_mm}mm · Total {frame.ancho_total_mm}mm
        {selRec
          ? " · puesto #" + (rank + 1) + " de " + recs.length + " recomendados"
          : metrics
            ? " · fuera del top: ver lista"
            : " · analizá para ver su probabilidad"}
      </small>
      {lenses.length > 0 && (
        <div className="scanner__lentes">
          <small><b>Lentes para este rostro + montura (clic para ver el tinte):</b></small>
          <div className="lentes-tags">
            {lenses.map((l) => (
              <button
                key={l.tipo}
                type="button"
                title={`${l.motivo} Clic para montar este lente.`}
                onClick={() => onSelectLens(l.tipo)}
                className={`lente-tag lente--${l.estado} ${tryLens === l.tipo ? "lente--active" : ""}`}
              >
                {l.estado === "compatible" ? "✓" : l.estado === "parcial" ? "~" : "✕"} {l.tipo} {l.prob}%
              </button>
            ))}
          </div>
          <small className="scanner__sub">
            Cristal montado: <LenteDot tipo={tryLens} /> <b>{tryLens}</b> — cambia con el modelo o un clic arriba
          </small>
        </div>
      )}
    </div>
  );
}
