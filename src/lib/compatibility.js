// Compatibilidad agregada por característica (forma, material, color, lente).
// El motor experto (`POST /recommend`) puntúa montura a montura; aquí se agrupa
// ese score por atributo para responder "¿qué tipo de montura me favorece?".
// Todo es cálculo de cliente: no hay endpoint nuevo ni se persiste nada.
import { lensCompatibility } from "./lensCompatibility.js";

const pct = (v) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * @typedef {{ frame_id: string, score: number, verdict?: string, reasons?: string[] }} RecLike
 * @typedef {{ id: string, forma?: string, material?: string, color?: string,
 *   A_mm?: number, B_mm?: number, D_mm?: number, tipo_lente?: string[] }} FrameLike
 * @typedef {{ ipd_mm_est?: number, ratios?: Record<string, number> }} MetricsLike
 */

/**
 * Media del score de las monturas que comparten un atributo.
 *
 * @param {RecLike[]} recs
 * @param {FrameLike[]} frames
 * @param {"forma"|"material"|"color"} attr
 * @returns {{ valor: string, pct: number, n: number }[]}
 */
export function attrPercentages(recs, frames, attr) {
  const byId = new Map((frames ?? []).map((f) => [f.id, f]));
  const acc = new Map();
  for (const r of recs ?? []) {
    const valor = byId.get(r.frame_id)?.[attr];
    if (!valor) continue;
    const cur = acc.get(valor) ?? { valor, suma: 0, n: 0 };
    cur.suma += Number(r.score) || 0;
    cur.n += 1;
    acc.set(valor, cur);
  }
  return [...acc.values()]
    .map((a) => ({ valor: a.valor, pct: pct(a.suma / a.n), n: a.n }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Probabilidad media de cada tipo de lente sobre las monturas recomendadas.
 *
 * @param {RecLike[]} recs
 * @param {FrameLike[]} frames
 * @returns {{ valor: string, pct: number, n: number }[]}
 */
export function lensPercentages(recs, frames) {
  const byId = new Map((frames ?? []).map((f) => [f.id, f]));
  const acc = new Map();
  for (const r of recs ?? []) {
    const frame = byId.get(r.frame_id);
    if (!frame) continue;
    for (const l of lensCompatibility(frame, r.score)) {
      const cur = acc.get(l.tipo) ?? { valor: l.tipo, suma: 0, n: 0 };
      cur.suma += l.prob;
      cur.n += 1;
      acc.set(l.tipo, cur);
    }
  }
  return [...acc.values()]
    .map((a) => ({ valor: a.valor, pct: pct(a.suma / a.n), n: a.n }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Centrado óptico: PD de la montura (A+D) frente a la IPD estimada del rostro.
 * Diferencias de hasta 4 mm se consideran centradas; hasta 8 mm, aceptables.
 *
 * @param {MetricsLike | null} metrics
 * @param {FrameLike | null} frame
 */
export function centering(metrics, frame) {
  const ipd = Number(metrics?.ipd_mm_est) || 0;
  const framePD = Number(frame?.A_mm ?? 0) + Number(frame?.D_mm ?? 0);
  const dif = ipd > 0 && framePD > 0 ? Math.abs(framePD - ipd) : null;
  const estado =
    dif == null ? "sin datos" : dif <= 4 ? "centrado" : dif <= 8 ? "aceptable" : "descentrado";
  return { ipd, framePD, dif, estado };
}

/**
 * Lectura orientativa de las tres proporciones del análisis morfométrico.
 *
 * @param {MetricsLike | null} metrics
 * @returns {{ clave: string, label: string, valor: number, texto: string }[]}
 */
export function ratioInsights(metrics) {
  const r = metrics?.ratios ?? {};
  const rows = [];
  const la = Number(r.largo_ancho);
  if (la > 0) {
    rows.push({
      clave: "largo_ancho",
      label: "Largo / ancho",
      valor: la,
      texto:
        la < 1.25
          ? "Rostro más corto que la media: las monturas con altura generosa lo equilibran."
          : la > 1.45
            ? "Rostro alargado: convienen monturas anchas y de poca altura."
            : "Proporción equilibrada: admite casi cualquier altura de montura.",
    });
  }
  const fp = Number(r.frente_pomulo);
  if (fp > 0) {
    rows.push({
      clave: "frente_pomulo",
      label: "Frente / pómulo",
      valor: fp,
      texto:
        fp > 1
          ? "Frente más ancha que los pómulos: monturas de scheel amplio evitan el efecto estrecho."
          : "Pómulos dominantes: monturas con puente firme y buen apoyo nasal.",
    });
  }
  const mf = Number(r.mandibula_frente);
  if (mf > 0) {
    rows.push({
      clave: "mandibula_frente",
      label: "Mandíbula / frente",
      valor: mf,
      texto:
        mf > 1
          ? "Mandíbula marcada: monturas de líneas suaves reducen el contraste."
          : "Mandíbula suave: monturas con ángulos definidos aportan estructura.",
    });
  }
  return rows;
}

/**
 * Compatibilidad de la montura que el cliente se probó físicamente, medida
 * sobre el segundo escaneo (no se compara con el primero).
 *
 * @param {MetricsLike | null} metrics
 * @param {FrameLike | null} frame
 * @param {RecLike | null} rec
 */
export function fitAssessment(metrics, frame, rec) {
  const cen = centering(metrics, frame);
  const score = Number(rec?.score) || 0;
  const verdict = rec?.verdict ?? (score >= 80 ? "compatible" : score >= 60 ? "parcial" : "incompatible");
  return {
    score,
    verdict,
    reasons: rec?.reasons ?? [],
    centering: cen,
    // Ajuste global: score del motor corregido por el centrado real.
    overall: pct(score - (cen.estado === "descentrado" ? 8 : cen.estado === "aceptable" ? 3 : 0)),
  };
}
