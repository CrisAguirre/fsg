import { useEffect, useState } from "react";
import { API_URL } from "../lib/api.js";
import "./AdminFrames.css";

const VACIO = { id: "", nombre: "", forma: "rectangular", A_mm: 52, B_mm: 36, D_mm: 18, patilla_mm: 140, ancho_total_mm: 140, material: "acetato", color: "negro", optica_id: "seed" };
const FORMAS = ["rectangular", "cuadrado", "redondo", "oval", "aviador", "wayfarer", "cat-eye", "rimless"];

export default function AdminFrames() {
  const [frames, setFrames] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState("");
  const [stats, setStats] = useState(null);

  const load = () =>
    fetch(`${API_URL}/frames`).then((r) => r.json()).then(setFrames).catch(() => setMsg("Sin conexión al backend"));
  useEffect(() => {
    load();
    fetch(`${API_URL}/feedback/stats`).then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar(e) {
    e.preventDefault();
    setMsg("");
    const num = ["A_mm", "B_mm", "D_mm", "patilla_mm", "ancho_total_mm"];
    const body = { ...form };
    num.forEach((k) => (body[k] = Number(body[k])));
    const url = editando ? `${API_URL}/frames/${form.id}` : `${API_URL}/frames`;
    const r = await fetch(url, { method: editando ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return setMsg(`Error ${r.status}: ${(await r.text()).slice(0, 160)}`);
    setForm(VACIO); setEditando(false); setMsg("Guardado ✓"); load();
  }

  async function borrar(id) {
    if (!confirm(`Eliminar ${id}?`)) return;
    const r = await fetch(`${API_URL}/frames/${id}`, { method: "DELETE" });
    setMsg(r.ok ? "Eliminado ✓" : "Error al eliminar");
    load();
  }

  return (
    <div className="container admin">
      <h1>Catálogo <span className="text-gradient">por óptica</span></h1>
      <p className="scanner__sub">Cada óptica filtra por <code>optica_id</code>. Sin login aún: protege esta ruta en prod (TODO auth).</p>
      {stats && <p className="glass admin__stats">Feedback: {stats.n} respuestas · ayuda {stats.avg_helpful ?? "—"}/5 · parcial {Math.round((stats.parcial_rate ?? 0) * 100)}% · <i>{stats.sugerencia}</i></p>}
      {msg && <p>{msg}</p>}
      <form className="glass admin__form" onSubmit={guardar}>
        <h3>{editando ? `Editando ${form.id}` : "Nuevo marco"}</h3>
        <div className="admin__grid">
          <label>ID<input value={form.id} disabled={editando} onChange={(e) => set("id", e.target.value.toUpperCase())} required placeholder="F13" /></label>
          <label>Nombre<input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required /></label>
          <label>Forma<select value={form.forma} onChange={(e) => set("forma", e.target.value)}>{FORMAS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label>Óptica<input value={form.optica_id} onChange={(e) => set("optica_id", e.target.value)} /></label>
          {[["A_mm", "A (ancho lente)"], ["B_mm", "B (alto)"], ["D_mm", "D (puente)"], ["patilla_mm", "Patilla"], ["ancho_total_mm", "Ancho total"]].map(([k, l]) => (
            <label key={k}>{l}<input type="number" step="0.5" value={form[k]} onChange={(e) => set(k, e.target.value)} /></label>
          ))}
          <label>Material<select value={form.material} onChange={(e) => set("material", e.target.value)}><option>acetato</option><option>metal</option><option>mixto</option></select></label>
          <label>Color<input value={form.color} onChange={(e) => set("color", e.target.value)} /></label>
        </div>
        <div className="scanner__row">
          <button className="btn btn--primary" type="submit">Guardar</button>
          {editando && <button className="btn btn--glass" type="button" onClick={() => { setForm(VACIO); setEditando(false); }}>Cancelar</button>}
        </div>
      </form>
      <div className="admin__tablewrap glass">
        <table className="admin__table">
          <thead><tr><th>ID</th><th>Nombre</th><th>Forma</th><th>A/B/D</th><th>Total</th><th>Óptica</th><th></th></tr></thead>
          <tbody>
            {frames.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td><td>{f.nombre}</td><td>{f.forma}</td>
                <td>{f.A_mm}/{f.B_mm}/{f.D_mm}</td><td>{f.ancho_total_mm}</td><td>{f.optica_id}</td>
                <td><button onClick={() => { setForm(f); setEditando(true); window.scrollTo(0, 0); }}>Editar</button> <button onClick={() => borrar(f.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
