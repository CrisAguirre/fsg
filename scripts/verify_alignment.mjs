// Verificación numérica de las anclas oculares compartidas por los motores 2D y 3D.
// Uso: node scripts/verify_alignment.mjs
// Criterios:
//  1. Sin iris (malla de 468) → ambos motores usan esquinas y coinciden.
//  2. Iris degenerado (placeholder) → fallback a esquinas, sin NaN.
//  3. Iris reales → ambos motores usan iris y la IPD coincide.
//  4. Roll sintético → el ángulo 2D y el roll 3D coinciden en magnitud y signo.
//  5. Rostro inclinado sin iris → las esquinas siguen siendo el respaldo.
import { measureGlasses } from "../src/components/tryon/GlassesOverlay.js";
import { estimatePose } from "../src/components/tryon/Frame3D.js";
import { FACE_IDX } from "../src/components/tryon/landmarks.js";

const N = 478;
const CW = 200;
const CH = 100;
const IRIS_A = [468, 469, 470, 471, 472];
const IRIS_B = [473, 474, 475, 476, 477];

const mk = (n = N) => Array.from({ length: n }, () => ({ x: 0.5, y: 0.5, z: 0 }));
const set = (lm, i, x, y, z = 0) => { lm[i] = { x, y, z }; };
const fill = (lm, ids, x, y) => { for (const i of ids) set(lm, i, x, y); };

// Rostro simétrico: esquinas a 0.2/0.4 y 0.6/0.8 (IPD = 0.4 normalizado = 80 px).
const face = (n = N) => {
  const lm = mk(n);
  set(lm, FACE_IDX.leftOuter, 0.2, 0.4);
  set(lm, FACE_IDX.leftInner, 0.4, 0.4);
  set(lm, FACE_IDX.rightInner, 0.6, 0.4);
  set(lm, FACE_IDX.rightOuter, 0.8, 0.4);
  set(lm, FACE_IDX.nose, 0.5, 0.5);
  set(lm, FACE_IDX.forehead, 0.5, 0.15);
  set(lm, FACE_IDX.chin, 0.5, 0.8);
  return lm;
};

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) fails++;
};
const finitePose = (p) => p && [p.cx, p.cy, p.ipd, p.roll, p.yaw, p.pitch].every(Number.isFinite);
const sameIpd = (m, p) => Math.abs(m.ipdPx - p.ipd * CW) < 1e-6;
const deg = (rad) => (Math.abs(rad) * 180) / Math.PI;

// Caso 1: malla de 468 puntos, sin iris → esquinas en ambos motores.
const noIris = face(468);
const m1 = measureGlasses(noIris, CW, CH);
const p1 = estimatePose(noIris, CW, CH);
check("468 pts: 2D usa esquinas", m1.anchor === "corner", `anchor=${m1.anchor}`);
check("468 pts: 3D usa esquinas", p1.anchor === "corner", `anchor=${p1.anchor}`);
check("468 pts: IPD 2D/3D coincide", sameIpd(m1, p1), `2D=${m1.ipdPx.toFixed(2)}px 3D=${p1.ipd.toFixed(3)}`);
check("468 pts: roll≈0", Math.abs(p1.roll) < 1e-6 && m1.angDeg < 1e-6, `roll=${p1.roll.toFixed(6)}`);

// Caso 2: 478 puntos con iris placeholder en (0.5, 0.5) → fallback seguro.
const degenerate = face();
const m2 = measureGlasses(degenerate, CW, CH);
const p2 = estimatePose(degenerate, CW, CH);
check("iris degenerado: 2D cae a esquinas", m2.anchor === "corner", `anchor=${m2.anchor}`);
check("iris degenerado: 3D cae a esquinas", p2.anchor === "corner", `anchor=${p2.anchor}`);
check("iris degenerado: pose finita", finitePose(p2));
check("iris degenerado: IPD 2D/3D coincide", sameIpd(m2, p2), `2D=${m2.ipdPx.toFixed(2)}px 3D=${p2.ipd.toFixed(3)}`);

// Caso 3: iris reales, más juntos que las esquinas → ambos usan iris.
const withIris = face();
fill(withIris, IRIS_A, 0.35, 0.4);
fill(withIris, IRIS_B, 0.65, 0.4);
const m3 = measureGlasses(withIris, CW, CH);
const p3 = estimatePose(withIris, CW, CH);
check("iris real: 2D usa iris", m3.anchor === "iris", `anchor=${m3.anchor}`);
check("iris real: 3D usa iris", p3.anchor === "iris", `anchor=${p3.anchor}`);
check("iris real: IPD 60 px / 0.30", Math.abs(m3.ipdPx - 60) < 1e-6 && Math.abs(p3.ipd - 0.3) < 1e-6, `2D=${m3.ipdPx.toFixed(2)}px 3D=${p3.ipd.toFixed(3)}`);
check("iris real: IPD 2D/3D coincide", sameIpd(m3, p3));
check("iris real: roll≈0", Math.abs(p3.roll) < 1e-6 && m3.angDeg < 1e-6);

// Caso 4: roll con iris (derecha 4 px más arriba que la izquierda).
const rolled = face();
fill(rolled, IRIS_A, 0.35, 0.42);
fill(rolled, IRIS_B, 0.65, 0.38);
const m4 = measureGlasses(rolled, CW, CH);
const p4 = estimatePose(rolled, CW, CH);
const expectedRoll = Math.atan2(-4, 60);
check("roll iris: 2D y 3D coinciden", Math.abs(m4.angDeg - deg(p4.roll)) < 1e-6, `2D=${m4.angDeg.toFixed(4)}° 3D=${deg(p4.roll).toFixed(4)}°`);
check("roll iris: magnitud esperada", Math.abs(p4.roll - expectedRoll) < 1e-6, `roll=${p4.roll.toFixed(6)}rad`);
check("roll iris: signo negativo", p4.roll < 0, `roll=${p4.roll.toFixed(6)}rad`);

// Caso 5: mismo roll sin iris → esquinas como respaldo y misma geometría.
const rolledCorners = face(468);
set(rolledCorners, FACE_IDX.leftOuter, 0.2, 0.38);
set(rolledCorners, FACE_IDX.leftInner, 0.4, 0.38);
set(rolledCorners, FACE_IDX.rightInner, 0.6, 0.42);
set(rolledCorners, FACE_IDX.rightOuter, 0.8, 0.42);
const m5 = measureGlasses(rolledCorners, CW, CH);
const p5 = estimatePose(rolledCorners, CW, CH);
check("roll esquinas: 2D usa esquinas", m5.anchor === "corner", `anchor=${m5.anchor}`);
check("roll esquinas: 3D usa esquinas", p5.anchor === "corner", `anchor=${p5.anchor}`);
check("roll esquinas: 2D y 3D coinciden", Math.abs(m5.angDeg - deg(p5.roll)) < 1e-6, `2D=${m5.angDeg.toFixed(4)}° 3D=${deg(p5.roll).toFixed(4)}°`);

console.log(fails === 0 ? "OK: anclas 2D/3D alineadas" : `FALLOS: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
