import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/layout/Navbar.jsx";
import Footer from "../components/layout/Footer.jsx";
import { API_URL } from "../lib/api.js";
import "./AdminFrames.css";

const FORMAS = ["oval", "redondo", "cuadrado", "corazon", "diamante", "oblongo", "triangular"];

export default function Piloto() {
  const [scan] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("gs_last_scan") || "null");
    } catch {
      return null;
    }
  });
  const [optica, setOptica] = useState("piloto-1");
  const [caso, setCaso] = useState(1);
  const [consent, setConsent] = useState(false);
  const [formaReal, setFormaReal] = useState(scan?.face_shape ?? "oval");
  const [formaDetectada] = useState(scan?.face_shape_detected ?? scan?.face_shape ?? "");
  const [marcoRecomendado, setMarcoRecomendado] = useState(scan?.frame_id ?? "");
  const [marcoLleva, setMarcoLleva] = useState("");
  const [vaBien, setVaBien] = useState("no_aplica");
  const [veredicto, setVeredicto] = useState(scan?.verdict ?? "compatible");
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
        face_shape: formaReal,
        face_shape_detected: formaDetectada || undefined,
        frame_id: marcoRecomendado || marcoLleva || "F01",
        recommended_frame_id: marcoRecomendado || undefined,
        verdict: veredicto,
        helpful: ayuda,
        optica_id: optica,
        caso_n: Number(caso),
        marco_lleva: marcoLleva || undefined,
        va_bien: vaBien,
        comment: `piloto: compra_intencion=${compraria || "?"}`,
      }),
    });
    if (!r.ok) return setMsg(`Error ${r.status} guardando el caso.`);
    setMsg(`Caso ${caso} guardado ✓ — pasa al siguiente.`);
    setCaso((n) => Number(n) + 1);
    setAyuda(0); setCompraria(""); setMarcoLleva(""); setVaBien("no_aplica");
  }

  return (
    <>
      <Navbar />
      <div className="container admin">
        <h1>Modo Piloto Óptica · <span className="text-gradient">Grupo Prisma Visión</span></h1>
        <p className="scanner__sub">Flujo de validación en óptica (5 min por persona). 1) Escanea en <Link to="/scanner">/scanner</Link> 2) registra aquí el caso clínico.</p>
      {scan ? (
        <p className="glass admin__stats">
          Precargado del último escaneo: forma <b>{scan.face_shape}</b>
          {formaDetectada && formaDetectada !== scan.face_shape ? ` (detectada: ${formaDetectada})` : ""}
          {scan.frame_id ? ` · top-1 ${scan.frame_id} (${scan.score ?? "?"} pts, ${scan.verdict ?? "?"})` : ""}.
          Si el óptico corrigió la forma, el escaneo ya la trae.
        </p>
      ) : (
        <p className="glass admin__stats">
          No hay un escaneo reciente en esta sesión. Puedes llenar el caso a mano o
          volver al <Link to="/scanner">escáner</Link> para precargar forma y top-1.
        </p>
      )}
      {msg && <p>{msg}</p>}
      <form className="glass admin__form" onSubmit={guardar}>
        <div className="admin__grid">
          <label>Óptica<input value={optica} onChange={(e) => setOptica(e.target.value)} required /></label>
          <label>Caso #<input type="number" min="1" max="99" value={caso} onChange={(e) => setCaso(Number(e.target.value))} required /></label>
          <label>Forma real (ojo óptico)<select value={formaReal} onChange={(e) => setFormaReal(e.target.value)}>{FORMAS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label>Forma detectada por IA<input value={formaDetectada || "—"} readOnly /></label>
          <label>Marco recomendado (top-1)<input value={marcoRecomendado} onChange={(e) => setMarcoRecomendado(e.target.value.toUpperCase())} placeholder="F04" /></label>
          <label>Marco que lleva / probó<input value={marcoLleva} onChange={(e) => setMarcoLleva(e.target.value.toUpperCase())} placeholder="F04" /></label>
          <label>¿Ese marco le queda bien?<select value={vaBien} onChange={(e) => setVaBien(e.target.value)}><option value="no_aplica">No aplica / sin gafas</option><option value="si">Sí</option><option value="no">No</option></select></label>
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
      <Footer />
    </>
  );
}
