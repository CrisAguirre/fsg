import { useState } from "react";
import { API_URL } from "../../lib/api.js";

export default function FeedbackBox({ metrics, top }) {
  const [v, setV] = useState(0);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="glass scanner__panel">¡Gracias! Tu voto ayuda a calibrar el sistema. ✓</p>;
  }

  return (
    <div className="glass scanner__panel">
      <b>¿La explicación te ayudó a decidir? </b>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className="btn btn--glass"
          style={{ margin: ".2rem", opacity: v === n ? 1 : 0.6 }}
          onClick={() => setV(n)}
        >
          {n}★
        </button>
      ))}
      <button
        className="btn btn--primary"
        disabled={!v}
        onClick={async () => {
          await fetch(`${API_URL}/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              face_shape: metrics?.face_shape ?? "oval",
              frame_id: top?.frame_id ?? "F01",
              verdict: top?.verdict ?? "compatible",
              helpful: v,
            }),
          }).catch(() => {});
          setDone(true);
        }}
      >
        Enviar
      </button>
    </div>
  );
}
