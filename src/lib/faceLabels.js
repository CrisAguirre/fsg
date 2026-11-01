// Etiquetas de forma facial compartidas por el escáner, el registro y el
// informe. Fuente única: si se añade una forma nueva al backend, se toca aquí.
export const FORMAS = [
  "oval",
  "redondo",
  "cuadrado",
  "corazon",
  "diamante",
  "oblongo",
  "triangular",
];

export const FORMA_LABEL = {
  oval: "Ovalado",
  redondo: "Redondo",
  cuadrado: "Cuadrado",
  corazon: "Corazón",
  diamante: "Diamante",
  oblongo: "Oblongo",
  triangular: "Triangular",
};

export const formaLabel = (value) => FORMA_LABEL[value] || value || "—";
