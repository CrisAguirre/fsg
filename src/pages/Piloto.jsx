import { useState } from "react";
import { API_URL } from "../lib/api.js";
import "./AdminFrames.css";

const FORMAS = ["oval", "redondo", "cuadrado", "corazon", "diamante", "oblongo", "triangular"];

export default function Piloto() {
  const [optica, setOptica] = useState("piloto-1");
  const [caso, setCaso] = useState(1);
  const [consent, setConsent] = useState(false);
  const [formaReal, setFormaReal] = useState("oval");
  const [marcoLleva, setMarcoLleva] = useState("");
  const [veredicto, setVeredicto] = useState("compatible");
  const [ayuda, setAyuda] = useState(0);
  const [compraria, setCompraria] = useState("");
  const [msg, setMsg] = useState("");

  async function guardar(e) {
    e.preventDefault();
    if (!consent) return setMsg("Falta el consentimiento del caso.");
    if (!ayuda) return setMsg("Marca la ayuda 1–5.");
    const r = await fetch(`${API_URL}/feedback`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        face_shape: formaReal, frame_id: marcoLleva || "F01", verdict: veredicto,
        helpful: ayuda, optica_id: optica, caso_n: Number(caso),
        comment: `piloto: compra_intencion=${compraria || "?"}`,
      }),
    });
    if (!r.ok) return setMsg(`Error ${r.status} guardando el caso.`);
    setMsg(`Caso ${caso} guardado ✓ — pasa al siguiente.`);
    setCaso((n) => n + 1);
    setAyuda(0); setCompraria(""); setMarcoLleva("");
  }

  return (
    <div className="container admin">
      <h1>Modo <span className="text-gradient">Piloto en óptica</span></h1>
      <p className="scanner__sub">Flujo 5 min por persona (ver <code>PILOTO_30.md</code>). 1) Escanea en <a href="/scanner">/scanner</a> 2) registra aquí el caso.</p>
      {msg && <p>{msg}</p>}
      <form className="glass admin__form" onSubmit={guardar}>
        <div className="admin__grid">
          <label>Óptica<input value={optica} onChange={(e) => setOptica(e.target.value)} required /></label>
          <label>Caso #<input type="number" min="1" max="99" value={caso} onChange={(e) => setCaso(e.target.value)} required /></label>
          <label>Forma real (ojo óptico)<select value={formaReal} onChange={(e) => setFormaReal(e.target.value)}>{FORMAS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label>Marco que lleva / probó<input value={marcoLleva} onChange={(e) => setMarcoLleva(e.target.value.toUpperCase())} placeholder="F04" /></label>
          <label>Veredicto del sistema<select value={veredicto} onChange={(e) => setVeredicto(e.target.value)}><option>compatible</option><option>parcial</option><option>incompatible</option></select></label>
          <label>¿Compraría el recomendado?<select value={compraria} onChange={(e) => setCompraria(e.target.value)}><option value="">—</option><option value="si">Sí</option><option value="duda">En duda</option><option value="no">No</option></select></label>
        </div>
        <div>
          <b>Ayuda 1–5: </b>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className="btn btn--glass" style={{ margin: ".2rem", opacity: ayuda === n ? 1 : 0.6 }} onClick={() => setAyuda(n)}>{n}★</button>
          ))}
        </div>
        <label style={{ display: "flex", gap: ".5rem" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Consentimiento del caso firmado (Ley 1581; menores con acudiente).
        </label>
        <button className="btn btn--primary" type="submit">Guardar caso</button>
      </form>
    </div>
  );
}
