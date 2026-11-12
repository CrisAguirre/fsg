// Ranking puro de recomendaciones para el informe.
// Separa la selección de monturas de los motores de try-on: así el informe y
// los montajes comparten el mismo orden, el mismo filtro de catálogo y la misma
// deduplicación por id.

/**
 * @typedef {{ id: string, nombre?: string, forma?: string, material?: string, color?: string, imagen_url?: string, [key: string]: any }} FrameLike
 * @typedef {{ frame_id: string, score: number, verdict?: string }} RecLike
 */

/**
 * Ordena por score, descarta recomendaciones que no están en el catálogo y
 * elimina ids repetidos.
 *
 * @param {Array<RecLike>} recs
 * @param {Array<FrameLike>} frames
 * @param {number} limit
 * @returns {Array<{frame: FrameLike, rec: RecLike}>}
 */
export function rankFrames(recs, frames, limit = Number.POSITIVE_INFINITY) {
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : Number.POSITIVE_INFINITY;
  if (max === 0) return [];

  const catalog = new Map((frames ?? []).map((frame) => [frame.id, frame]));
  const seen = new Set();
  const ranked = [];
  const sorted = [...(recs ?? [])].sort(
    (a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0),
  );

  for (const rec of sorted) {
    const frame = catalog.get(rec?.frame_id);
    if (!frame || seen.has(frame.id)) continue;
    seen.add(frame.id);
    ranked.push({ frame, rec });
    if (ranked.length >= max) break;
  }
  return ranked;
}

/** Forma normalizada; vacía si el catálogo no la declara. */
function shapeOf(frame) {
  return String(frame?.forma ?? "").trim().toLowerCase();
}

/**
 * Elige las mejores monturas priorizando formas distintas. Si las dos mejores
 * comparten forma, la segunda se sustituye por la mejor de otra forma para que
 * el informe no muestre dos monturas (y dos assets) prácticamente iguales.
 * Si no hay suficientes formas distintas, completa por score.
 *
 * @param {Array<RecLike>} recs
 * @param {Array<FrameLike>} frames
 * @param {number} limit
 * @returns {Array<{frame: FrameLike, rec: RecLike}>}
 */
export function pickDiverseFrames(recs, frames, limit = 2) {
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : Number.POSITIVE_INFINITY;
  if (max === 0) return [];

  const ranked = rankFrames(recs, frames);
  const picked = [];
  const chosen = new Set();
  const usedShapes = new Set();

  // Primera pasada: una montura por forma, en orden de score.
  for (const item of ranked) {
    if (picked.length >= max) break;
    const shape = shapeOf(item.frame);
    if (shape && usedShapes.has(shape)) continue;
    if (shape) usedShapes.add(shape);
    picked.push(item);
    chosen.add(item.frame.id);
  }

  // Segunda pasada: si no hay formas suficientes, completa por score.
  if (picked.length < max) {
    for (const item of ranked) {
      if (picked.length >= max) break;
      if (chosen.has(item.frame.id)) continue;
      picked.push(item);
      chosen.add(item.frame.id);
    }
  }

  return picked;
}
