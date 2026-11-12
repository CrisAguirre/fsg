// Informe membreteado del escaneo: documento maquetado (portada, resumen, KPIs,
// secciones numeradas y gráficos) que se ve igual en pantalla y en A4 impreso.
// Se genera en el cliente: no se envía ni se guarda la foto.
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
import { rankFrames } from "../../lib/frameRanking.js";

const mm = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? `${Number(v).toFixed(1)} mm` : "—");
const num = (v, d = 2) => (Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—");

function folioOf(iso) {
  const d = new Date(iso);
  const stamp = d.toISOString().slice(0, 10).replaceAll("-", "");
  const hhmm = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `GPV-${stamp}-${hhmm}`;
}

/** Miniatura de producto por forma; el informe cae a `imagen_url` si falta. */
function thumbOf(frame) {
  const key = String(frame?.forma ?? "").trim().toLowerCase();
  return key ? `/frames/thumbs/${key}.jpg` : "";
}

function buildReport({ mode, metrics, detectedShape, recs, frames, scanMeta, frame, fitRec }) {
  const at = scanMeta?.at ?? new Date().toISOString();
  const formas = attrPercentages(recs, frames, "forma");
  const materiales = attrPercentages(recs, frames, "material");
  const colores = attrPercentages(recs, frames, "color");
  const lentes = lensPercentages(recs, frames);
  const top = rankFrames(recs, frames, 10).map(({ frame: f, rec }, index) => ({
    rank: index + 1,
    id: f.id,
    nombre: f.nombre ?? f.id,
    forma: f.forma ?? "—",
    material: f.material ?? "—",
    color: f.color ?? "—",
    score: Number(rec?.score) || 0,
    verdict: rec?.verdict ?? "",
    imagen_url: f.imagen_url || `/frames/${f.forma || "rectangular"}.jpg`,
    thumb_url: thumbOf(f),
  }));

  const forma = formaLabel(metrics?.face_shape);
  const simetria = Math.round(Number(metrics?.symmetry_index ?? 0));
  const mejorForma = formas[0];
  const mejorMaterial = materiales[0];
  const mejorColor = colores[0];
  const mejorLente = lentes[0];
  const ajuste = mode === "fit" && frame ? fitAssessment(metrics, frame, fitRec) : null;

  const resumen =
    mode === "fit" && frame
      ? `Escaneo con la montura "${frame.nombre}" puesta. El ajuste global es del ${ajuste.overall}% sobre un rostro ${forma.toLowerCase()} con simetría del ${simetria}%.`
      : `Rostro ${forma.toLowerCase()} con simetría del ${simetria}%. La forma de montura que mejor te favorece es ${mejorForma?.valor ?? "—"} (${mejorForma?.pct ?? 0}%)${mejorLente ? `, con lente ${mejorLente.valor} (${mejorLente.pct}%)` : ""}.`;

  return {
    documento: mode === "fit" ? "informe_ajuste_montura" : "informe_escaneo_facial",
    folio: folioOf(at),
    fecha: at,
    origen: scanMeta?.source ?? "—",
    forma_detectada: formaLabel(detectedShape || metrics?.face_shape),
    forma_confirmada: forma,
    simetria_pct: simetria,
    resumen,
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
    compatibilidad: { forma: formas, material: materiales, color: colores, lente: lentes },
    destacados: { forma: mejorForma, material: mejorMaterial, color: mejorColor, lente: mejorLente },
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
    ajuste,
    advertencias: metrics?.warnings ?? [],
    aviso:
      "Resultado orientativo generado por el motor experto de Grupo Prisma Visión. No sustituye la valoración de un optómetra. La imagen se procesa solo para este análisis y no se almacena en el servidor (Ley 1581 de 2012).",
  };
}

function Section({ n, title, children, className = "" }) {
  return (
    <section className={`report__section ${className}`}>
      <h3>
        <span className="report__num" aria-hidden="true">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Kpi({ label, value, note }) {
  return (
    <div className="report__kpi">
      <span className="report__kpi-label">{label}</span>
      <b className="report__kpi-value">{value}</b>
      {note && <span className="report__kpi-note">{note}</span>}
    </div>
  );
}

function Bars({ title, rows }) {
  if (!rows?.length) return null;
  const top = rows.slice(0, 5);
  return (
    <div className="report__block">
      <h4>{title}</h4>
      <ul className="report__bars">
        {top.map((r) => (
          <li key={r.valor}>
            <span className="report__bar-label">{r.valor}</span>
            <span className="report__bar-track">
              <span className="report__bar-fill" style={{ width: `${r.pct}%` }} />
            </span>
            <span className="report__bar-value">{r.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const VERDICT_LABEL = { compatible: "Compatible", parcial: "Parcial", incompatible: "Incompatible" };

export default function ScanReport({
  mode = "scan",
  metrics,
  detectedShape,
  recs,
  frames,
  scanMeta,
  frame = null,
  fitRec = null,
  photoUrl = null,
  tryOns = [],
  tryOnLoading = false,
  tryOnError = "",
  tryOnRetryable = false,
  onRetryTryOns = null,
  onClose,
}) {
  const data = useMemo(
    () => buildReport({ mode, metrics, detectedShape, recs, frames, scanMeta, frame, fitRec }),
    [mode, metrics, detectedShape, recs, frames, scanMeta, frame, fitRec],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
  const esAjuste = mode === "fit" && !!data.montura_evaluada;

  return (
    <div className="report-overlay" role="dialog" aria-modal="true" aria-label="Informe del escaneo">
      <div className="report-toolbar">
        <div className="report-toolbar__title">
          <b>{esAjuste ? "Informe de ajuste" : "Informe del escaneo"}</b>
          <small>En PDF: elige “Guardar como PDF” en el diálogo de impresión.</small>
        </div>
        <div className="report-toolbar__actions">
          <button type="button" className="btn btn--glass btn--sm" onClick={downloadJson}>
            ⬇ JSON
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => window.print()}
            title="Abre el diálogo de impresión: elige Guardar como PDF"
          >
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
          <div className="report__brand">
            <h1>Grupo Prisma Visión</h1>
            <p>Glassescanner 3D · Asesoría óptica asistida</p>
          </div>
          <div className="report__folio">
            <span>Folio</span>
            <b>{data.folio}</b>
            <span>{new Date(data.fecha).toLocaleString("es-CO")}</span>
          </div>
        </header>

        <div className="report__title">
          <span className="report__eyebrow">
            {esAjuste ? "Segundo escaneo · montura puesta" : "Primer escaneo · sin monturas"}
          </span>
          <h2>{esAjuste ? "Informe de ajuste de montura" : "Informe de análisis facial"}</h2>
          <p>{data.resumen}</p>
        </div>

        {photoUrl && (
          <section className="report__visual" aria-label="Registro visual del escaneo">
            <figure className="report__shot report__shot--original">
              <img src={photoUrl} alt="Fotografía original del rostro escaneado" />
              <figcaption>
                <b>Fotografía original</b>
                <span>Imagen analizada en este escaneo</span>
              </figcaption>
            </figure>

            {tryOnLoading ? (
              <>
                <div className="report__shot report__shot--loading" aria-hidden="true">
                  <span className="report__shot-skeleton" />
                </div>
                <div className="report__shot report__shot--loading" aria-hidden="true">
                  <span className="report__shot-skeleton" />
                </div>
                <p className="report__visual-note" role="status">
                  Generando los montajes con las dos monturas de mayor compatibilidad…
                </p>
              </>
            ) : (
              tryOns.map((t) => (
                <figure key={t.id} className="report__shot">
                  <img
                    src={t.dataUrl}
                    alt={`Montura ${t.nombre} sobre la fotografía original`}
                  />
                  <figcaption>
                    <b>{t.nombre}</b>
                    <span>
                      {t.score} pts · {VERDICT_LABEL[t.verdict] ?? t.verdict}
                    </span>
                  </figcaption>
                </figure>
              ))
            )}

            {!tryOnLoading && tryOns.length === 0 && (
              <div className="report__visual-note" role="status">
                <span>{tryOnError || "Los montajes no están disponibles para esta foto."}</span>
                {onRetryTryOns && tryOnRetryable && (
                  <button type="button" className="btn btn--glass btn--sm" onClick={onRetryTryOns}>
                    Reintentar montajes
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        <div className="report__kpis">
          <Kpi label="Tipo de rostro" value={data.forma_confirmada} note={`Detectado: ${data.forma_detectada}`} />
          <Kpi label="Simetría facial" value={`${data.simetria_pct}%`} note="Índice orientativo" />
          {esAjuste ? (
            <>
              <Kpi label="Ajuste global" value={`${data.ajuste.overall}%`} note={`${data.ajuste.score} pts del motor`} />
              <Kpi label="Centrado óptico" value={cen?.estado ?? "—"} note={`PD ${cen?.framePD ?? "—"} vs IPD ${cen?.ipd ?? "—"} mm`} />
            </>
          ) : (
            <>
              <Kpi
                label="Mejor forma"
                value={data.destacados.forma ? `${data.destacados.forma.pct}%` : "—"}
                note={data.destacados.forma?.valor ?? "Sin catálogo"}
              />
              <Kpi
                label="Mejor lente"
                value={data.destacados.lente ? `${data.destacados.lente.pct}%` : "—"}
                note={data.destacados.lente?.valor ?? "—"}
              />
            </>
          )}
        </div>

        <Section n="1" title="Datos del escaneo">
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
        </Section>

        <Section n="2" title="Composición y tipo de rostro">
          <p className="report__lead">
            El sistema experto define un rostro <b>{data.forma_confirmada.toLowerCase()}</b>. Las
            proporciones explican por qué unas monturas favorecen más que otras.
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
        </Section>

        {esAjuste ? (
          <Section n="3" title="Montura evaluada">
            <div className="report__frame">
              <div className="report__frame-id">
                <span>{data.montura_evaluada.id}</span>
                <b>{data.montura_evaluada.nombre}</b>
              </div>
              <dl className="report__frame-specs">
                <div><dt>Forma</dt><dd>{data.montura_evaluada.forma}</dd></div>
                <div><dt>Material</dt><dd>{data.montura_evaluada.material}</dd></div>
                <div><dt>Color</dt><dd>{data.montura_evaluada.color}</dd></div>
                <div><dt>A / B / D</dt><dd>{data.montura_evaluada.A_mm} / {data.montura_evaluada.B_mm} / {data.montura_evaluada.D_mm} mm</dd></div>
                <div><dt>Ancho total</dt><dd>{mm(data.montura_evaluada.ancho_total_mm)}</dd></div>
              </dl>
            </div>

            <div className="report__fit">
              <div className="report__fit-score">
                <b>{data.ajuste.overall}%</b>
                <span>ajuste global</span>
              </div>
              <div className="report__fit-body">
                <p className="report__fit-verdict">
                  <span className={`report__chip report__chip--${data.ajuste.verdict}`}>
                    {VERDICT_LABEL[data.ajuste.verdict] ?? data.ajuste.verdict}
                  </span>
                  <b>{data.ajuste.score} pts</b> del motor experto · centrado{" "}
                  <b>{cen?.estado}</b>
                  {cen?.dif != null ? ` (${num(cen.dif, 1)} mm PD/IPD)` : ""}
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
          </Section>
        ) : (
          <Section n="3" title="Monturas mejor valoradas">
            {data.top_monturas.length === 0 ? (
              <p className="report__visual-note" role="status">
                No hay monturas recomendadas para este escaneo.
              </p>
            ) : (
              <>
                <p className="report__lead">
                  Las {data.top_monturas.length} monturas con mayor compatibilidad
                  del catálogo. Las fotos son de producto y no están montadas sobre
                  tu fotografía.
                </p>
                <ul className="report__frames">
                  {data.top_monturas.map((t) => (
                    <li key={t.id} className="report__frame-card">
                      <div className="report__frame-photo">
                        <img
                          src={t.thumb_url || t.imagen_url}
                          alt={`Montura ${t.nombre}`}
                          decoding="async"
                          loading="eager"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (img.dataset.fallback === "1" || !t.imagen_url) return;
                            img.dataset.fallback = "1";
                            img.src = t.imagen_url;
                          }}
                        />
                        <span className="report__frame-rank" aria-hidden="true">
                          {t.rank}
                        </span>
                      </div>
                      <div className="report__frame-body">
                        <b>{t.nombre}</b>
                        <span>
                          {t.forma} · {t.material} · {t.color}
                        </span>
                        <div className="report__frame-foot">
                          <span className={`report__chip report__chip--${t.verdict}`}>
                            {VERDICT_LABEL[t.verdict] ?? t.verdict}
                          </span>
                          <b>{t.score} pts</b>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        )}

        <Section n="4" title="Compatibilidad por tipo de montura">
          <div className="report__bars-grid">
            <Bars title="Forma de montura" rows={data.compatibilidad.forma} />
            <Bars title="Material" rows={data.compatibilidad.material} />
            <Bars title="Color" rows={data.compatibilidad.color} />
            <Bars title="Tipo de lente" rows={data.compatibilidad.lente} />
          </div>
        </Section>

        {data.advertencias.length > 0 && (
          <Section n="5" title="Observaciones del análisis">
            <ul className="report__reasons">
              {data.advertencias.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Section>
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
