// Informe membreteado del escaneo (descargable como PDF con Ctrl+P / Guardar
// como PDF). Se genera en el cliente: no se envía ni se guarda la foto.
import { useEffect, useMemo } from "react";
import logoBlack from "../../assets/logoblack.png";
import {
  attrPercentages,
  centering,
  fitAssessment,
  lensPercentages,
  ratioInsights,
} from "../../lib/compatibility.js";
import { formaLabel } from "../../lib/faceLabels.js";

const mm = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? `${Number(v).toFixed(1)} mm` : "—");
const num = (v, d = 2) => (Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—");

function folioOf(iso) {
  const d = new Date(iso);
  const stamp = d.toISOString().slice(0, 10).replaceAll("-", "");
  const hhmm = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `GPV-${stamp}-${hhmm}`;
}

function buildReport({ mode, metrics, detectedShape, recs, frames, scanMeta, frame, fitRec }) {
  const at = scanMeta?.at ?? new Date().toISOString();
  const formas = attrPercentages(recs, frames, "forma");
  const materiales = attrPercentages(recs, frames, "material");
  const colores = attrPercentages(recs, frames, "color");
  const lentes = lensPercentages(recs, frames);
  const top = [...(recs ?? [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => {
      const f = (frames ?? []).find((x) => x.id === r.frame_id);
      return {
        id: r.frame_id,
        nombre: f?.nombre ?? r.frame_id,
        forma: f?.forma ?? "—",
        score: r.score,
        verdict: r.verdict,
      };
    });

  return {
    documento: mode === "fit" ? "informe_ajuste_montura" : "informe_escaneo_facial",
    folio: folioOf(at),
    fecha: at,
    origen: scanMeta?.source ?? "—",
    forma_detectada: formaLabel(detectedShape || metrics?.face_shape),
    forma_confirmada: formaLabel(metrics?.face_shape),
    simetria_pct: Math.round(Number(metrics?.symmetry_index ?? 0)),
    medidas: {
      ipd_mm: Number(metrics?.ipd_mm_est) || null,
      ancho_temporal_mm: Number(metrics?.temporal_est) || null,
      puente_nasal_mm: Number(metrics?.nose_bridge_mm_est) || null,
    },
    composicion: ratioInsights(metrics).map((r) => ({
      clave: r.clave,
      label: r.label,
      valor: r.valor,
      lectura: r.texto,
    })),
    compatibilidad: {
      forma: formas,
      material: materiales,
      color: colores,
      lente: lentes,
    },
    top_monturas: top,
    montura_evaluada:
      mode === "fit" && frame
        ? {
            id: frame.id,
            nombre: frame.nombre,
            forma: frame.forma,
            material: frame.material,
            color: frame.color,
            A_mm: frame.A_mm,
            B_mm: frame.B_mm,
            D_mm: frame.D_mm,
            ancho_total_mm: frame.ancho_total_mm,
          }
        : null,
    ajuste:
      mode === "fit" && frame
        ? fitAssessment(metrics, frame, fitRec)
        : null,
    advertencias: metrics?.warnings ?? [],
    aviso:
      "Resultado orientativo generado por el motor experto de Grupo Prisma Visión. No sustituye la valoración de un optómetra. La imagen se procesa solo para este análisis y no se almacena en el servidor (Ley 1581 de 2012).",
  };
}

function Bars({ title, rows, suffix = "" }) {
  if (!rows?.length) return null;
  return (
    <div className="report__block">
      <h4>{title}</h4>
      <ul className="report__bars">
        {rows.map((r) => (
          <li key={r.valor}>
            <span className="report__bar-label">{r.valor}</span>
            <span className="report__bar-track">
              <span className="report__bar-fill" style={{ width: `${r.pct}%` }} />
            </span>
            <span className="report__bar-value">
              {r.pct}%{suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ScanReport({
  mode = "scan",
  metrics,
  detectedShape,
  recs,
  frames,
  scanMeta,
  frame = null,
  fitRec = null,
  onClose,
}) {
  const data = useMemo(
    () => buildReport({ mode, metrics, detectedShape, recs, frames, scanMeta, frame, fitRec }),
    [mode, metrics, detectedShape, recs, frames, scanMeta, frame, fitRec],
  );

  function downloadJson() {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${data.documento}-${data.folio}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      /* descarga no disponible */
    }
  }

  const cen = mode === "fit" && frame ? centering(metrics, frame) : null;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="report-overlay" role="dialog" aria-modal="true" aria-label="Informe del escaneo">
      <div className="report-toolbar">
        <b>{mode === "fit" ? "Informe de ajuste" : "Informe del escaneo"}</b>
        <div className="report-toolbar__actions">
          <button type="button" className="btn btn--glass btn--sm" onClick={downloadJson}>
            ⬇ JSON
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()}>
            ⬇ Descargar PDF
          </button>
          <button type="button" className="btn btn--glass btn--sm" onClick={onClose}>
            ✕ Cerrar
          </button>
        </div>
      </div>

      <article className="report-doc">
        <header className="report__head">
          <img src={logoBlack} alt="Grupo Prisma Visión" className="report__logo" />
          <div className="report__head-text">
            <h1>Grupo Prisma Visión</h1>
            <p>Informe de {mode === "fit" ? "ajuste de montura" : "análisis facial"}</p>
          </div>
          <div className="report__folio">
            <span>Folio</span>
            <b>{data.folio}</b>
            <span>{new Date(data.fecha).toLocaleString("es-CO")}</span>
          </div>
        </header>

        <section className="report__section">
          <h2>1. Datos del escaneo</h2>
          <table className="report__table">
            <tbody>
              <tr>
                <th>Origen</th>
                <td>{data.origen}</td>
                <th>Forma detectada</th>
                <td>{data.forma_detectada}</td>
              </tr>
              <tr>
                <th>Forma confirmada</th>
                <td>{data.forma_confirmada}</td>
                <th>Índice de simetría</th>
                <td>{data.simetria_pct} %</td>
              </tr>
              <tr>
                <th>IPD estimada</th>
                <td>{mm(data.medidas.ipd_mm)}</td>
                <th>Ancho temporal</th>
                <td>{mm(data.medidas.ancho_temporal_mm)}</td>
              </tr>
              <tr>
                <th>Puente nasal</th>
                <td>{mm(data.medidas.puente_nasal_mm)}</td>
                <th>Zona de cejas</th>
                <td>{metrics?.eyebrow_in_frame_zone ? "Despejada" : "Requiere atención"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="report__section">
          <h2>2. Composición y tipo de rostro</h2>
          <p className="report__lead">
            Tipo de rostro definido por el sistema experto: <b>{data.forma_confirmada}</b>.
            Las proporciones siguientes explican por qué se recomiendan unas monturas y no otras.
          </p>
          <ul className="report__insights">
            {data.composicion.map((c) => (
              <li key={c.clave}>
                <b>
                  {c.label}: {num(c.valor)}
                </b>
                <span>{c.lectura}</span>
              </li>
            ))}
          </ul>
        </section>

        {mode === "fit" && data.montura_evaluada ? (
          <section className="report__section">
            <h2>3. Montura evaluada</h2>
            <table className="report__table">
              <tbody>
                <tr>
                  <th>Montura</th>
                  <td colSpan={3}>{data.montura_evaluada.nombre} · {data.montura_evaluada.id}</td>
                </tr>
                <tr>
                  <th>Forma</th>
                  <td>{data.montura_evaluada.forma}</td>
                  <th>Material / color</th>
                  <td>
                    {data.montura_evaluada.material} · {data.montura_evaluada.color}
                  </td>
                </tr>
                <tr>
                  <th>Medidas A/B/D</th>
                  <td>
                    {data.montura_evaluada.A_mm} / {data.montura_evaluada.B_mm} /{" "}
                    {data.montura_evaluada.D_mm} mm
                  </td>
                  <th>Ancho total</th>
                  <td>{mm(data.montura_evaluada.ancho_total_mm)}</td>
                </tr>
              </tbody>
            </table>
            <div className="report__fit">
              <div className="report__fit-score">
                <b>{data.ajuste.overall}%</b>
                <span>ajuste global</span>
              </div>
              <div className="report__fit-body">
                <p>
                  Compatibilidad del motor experto: <b>{data.ajuste.score} pts</b> ·{" "}
                  {data.ajuste.verdict === "compatible"
                    ? "compatible"
                    : data.ajuste.verdict === "parcial"
                      ? "parcial"
                      : "incompatible"}
                </p>
                <p>
                  Centrado óptico: PD montura {cen?.framePD ?? "—"} mm vs IPD {cen?.ipd ?? "—"} mm ·{" "}
                  <b>{cen?.estado ?? "sin datos"}</b>
                  {cen?.dif != null ? ` (${num(cen.dif, 1)} mm de diferencia)` : ""}
                </p>
                {data.ajuste.reasons.length > 0 && (
                  <ul className="report__reasons">
                    {data.ajuste.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="report__section">
            <h2>3. Monturas mejor valoradas</h2>
            <table className="report__table report__table--list">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Montura</th>
                  <th>Forma</th>
                  <th>Score</th>
                  <th>Veredicto</th>
                </tr>
              </thead>
              <tbody>
                {data.top_monturas.map((t, i) => (
                  <tr key={t.id}>
                    <td>{i + 1}</td>
                    <td>{t.nombre}</td>
                    <td>{t.forma}</td>
                    <td>{t.score} pts</td>
                    <td>{t.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="report__section">
          <h2>4. Compatibilidad por tipo de montura</h2>
          <Bars title="Forma de montura" rows={data.compatibilidad.forma} />
          <Bars title="Material" rows={data.compatibilidad.material} />
          <Bars title="Color" rows={data.compatibilidad.color} />
          <Bars title="Tipo de lente" rows={data.compatibilidad.lente} />
        </section>

        {data.advertencias.length > 0 && (
          <section className="report__section">
            <h2>Observaciones del análisis</h2>
            <ul className="report__reasons">
              {data.advertencias.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="report__foot">
          <p>{data.aviso}</p>
          <div className="report__sign">
            <span>Grupo Prisma Visión · Asesoría óptica</span>
            <span>Firma del asesor: ____________________</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
