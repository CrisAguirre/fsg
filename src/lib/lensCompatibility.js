// Compatibilidad lente ↔ montura ↔ rostro (óptica real, no lista genérica).
// Califica cada tipo de lente del catálogo según la geometría de la montura
// (B/D) y el score del rostro. Vive fuera del componente para poder testearla.

export const LENTES_ORDEN = [
  "monofocal",
  "blue-cut",
  "fotocromático",
  "polarizado",
  "bifocal",
  "progresivo",
];

export function lensCompatibility(frame, frameScore = null) {
  if (!frame) return [];
  const B = Number(frame.B_mm ?? 0);
  const offered = new Set(frame.tipo_lente || []);
  const base = frameScore ?? 80;
  const rows = [];
  for (const tipo of LENTES_ORDEN) {
    if (!offered.has(tipo)) continue; // la montura no lo ofrece: no se muestra
    let estado = "compatible";
    let motivo = "Compatible con esta montura.";
    let pen = 0;
    if (tipo === "progresivo") {
      if (B < 28) {
        estado = "incompatible";
        motivo = `Requiere altura B≥28mm (esta: ${B}mm).`;
        pen = 45;
      } else if (B < 30) {
        estado = "parcial";
        motivo = `B=${B}mm justo para progresivo (ideal ≥30mm).`;
        pen = 12;
      } else {
        motivo = `B=${B}mm permite corredor progresivo amplio.`;
      }
    } else if (tipo === "bifocal") {
      if (B < 26) {
        estado = "incompatible";
        motivo = `Requiere altura B≥26mm (esta: ${B}mm).`;
        pen = 40;
      } else {
        motivo = `B=${B}mm admite segmento bifocal.`;
      }
    } else if (tipo === "fotocromático" && frame.forma === "rimless") {
      estado = "parcial";
      motivo = "En rimless exige perforado especial.";
      pen = 12;
    } else if (tipo === "polarizado" && frame.forma === "rimless") {
      estado = "parcial";
      motivo = "En rimless, fijación delicada para polarizado.";
      pen = 10;
    } else if (tipo === "blue-cut") {
      motivo = "Filtro luz azul sin exigencia geométrica.";
    } else if (tipo === "monofocal") {
      motivo = "Se adapta a cualquier geometría.";
    } else if (tipo === "polarizado") {
      motivo = "Ideal sol/conducción en esta montura.";
    }
    rows.push({
      tipo,
      estado,
      motivo,
      prob: Math.max(5, Math.min(99, Math.round(base - pen))),
    });
  }
  return rows.sort((a, b) => b.prob - a.prob);
}
