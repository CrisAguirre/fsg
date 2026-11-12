// Anclas faciales compartidas por los motores 2D y 3D.
// MediaPipe Face Landmarker de 478 puntos incluye los iris (468-477). Cuando la
// malla es de 468 puntos, los iris vienen como puntos placeholder o no existen,
// así que se cae a las esquinas oculares para no romper fotos ni modelos viejos.

export const FACE_IDX = {
  leftOuter: 33,
  leftInner: 133,
  rightInner: 362,
  rightOuter: 263,
  nose: 168,
  forehead: 10,
  chin: 152,
};

const IRIS_A = [468, 469, 470, 471, 472];
const IRIS_B = [473, 474, 475, 476, 477];
const IRIS_MIN_LENGTH = 478;

// Si los dos centros de iris están más cerca que este porcentaje del ancho de
// la imagen, el dato no es utilizable (malla sin iris o puntos placeholder) y
// se usan las esquinas oculares.
const IRIS_MIN_IPD_RATIO = 0.02;

const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Centroide de un conjunto de landmarks; null si falta alguno. */
function centroid(lm, ids, X, Y) {
  let sx = 0;
  let sy = 0;
  for (const id of ids) {
    const p = lm[id];
    if (!finite(p)) return null;
    sx += X(p);
    sy += Y(p);
  }
  return { x: sx / ids.length, y: sy / ids.length };
}

/**
 * Anclas oculares en píxeles.
 * `lc`/`rc` son los centros de iris cuando están disponibles; si no, el punto
 * medio de las esquinas oculares. `source` indica cuál se usó.
 *
 * @param {Array<{x:number,y:number,z?:number}>} lm
 * @param {number} cw ancho de la imagen en píxeles
 * @param {number} ch alto de la imagen en píxeles
 * @returns {null|{
 *   lc:{x:number,y:number}, rc:{x:number,y:number}, source:"iris"|"corner",
 *   irisL:{x:number,y:number}|null, irisR:{x:number,y:number}|null,
 *   cornerL:{x:number,y:number}, cornerR:{x:number,y:number},
 *   eyeW:number, eyeWL:number, eyeWR:number,
 *   ipdPx:number, ang:number, cornerIpdPx:number, cornerAng:number,
 *   bridge:{x:number,y:number}|null, nose:{x:number,y:number,z?:number}|null
 * }}
 */
export function eyeAnchors(lm, cw, ch) {
  if (!lm || lm.length < 400 || !(cw > 0) || !(ch > 0)) return null;
  const X = (p) => p.x * cw;
  const Y = (p) => p.y * ch;

  const lo = lm[FACE_IDX.leftOuter];
  const li = lm[FACE_IDX.leftInner];
  const ri = lm[FACE_IDX.rightInner];
  const ro = lm[FACE_IDX.rightOuter];
  if (![lo, li, ri, ro].every(finite)) return null;

  const cornerL = { x: (X(lo) + X(li)) / 2, y: (Y(lo) + Y(li)) / 2 };
  const cornerR = { x: (X(ri) + X(ro)) / 2, y: (Y(ri) + Y(ro)) / 2 };
  const eyeWL = Math.hypot(X(li) - X(lo), Y(li) - Y(lo));
  const eyeWR = Math.hypot(X(ri) - X(ro), Y(ri) - Y(ro));
  const eyeW = (eyeWL + eyeWR) / 2;

  let irisA = null;
  let irisB = null;
  if (lm.length >= IRIS_MIN_LENGTH) {
    irisA = centroid(lm, IRIS_A, X, Y);
    irisB = centroid(lm, IRIS_B, X, Y);
  }

  let lc = cornerL;
  let rc = cornerR;
  /** @type {"iris"|"corner"} */
  let source = "corner";
  let irisL = null;
  let irisR = null;
  if (irisA && irisB) {
    // Asignación por x de la imagen: no dependemos de la convención
    // izquierda/derecha del modelo. `lc` es la izquierda de la imagen y `rc` la
    // derecha, igual que las esquinas 33/133 y 362/263.
    const [first, second] = irisA.x <= irisB.x ? [irisA, irisB] : [irisB, irisA];
    const irisIpd = Math.hypot(second.x - first.x, second.y - first.y);
    if (irisIpd > cw * IRIS_MIN_IPD_RATIO) {
      lc = first;
      rc = second;
      irisL = first;
      irisR = second;
      source = "iris";
    }
  }

  const ipdPx = Math.hypot(rc.x - lc.x, rc.y - lc.y);
  const ang = Math.atan2(rc.y - lc.y, rc.x - lc.x);
  const cornerIpdPx = Math.hypot(cornerR.x - cornerL.x, cornerR.y - cornerL.y);
  const cornerAng = Math.atan2(cornerR.y - cornerL.y, cornerR.x - cornerL.x);
  const nose = lm[FACE_IDX.nose];
  const bridge = finite(nose) ? { x: X(nose), y: Y(nose) } : null;

  return {
    lc,
    rc,
    source,
    irisL,
    irisR,
    cornerL,
    cornerR,
    eyeW,
    eyeWL,
    eyeWR,
    ipdPx,
    ang,
    cornerIpdPx,
    cornerAng,
    bridge,
    nose: finite(nose) ? nose : null,
  };
}
