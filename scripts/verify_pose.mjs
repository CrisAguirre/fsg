// Verificación numérica del probador (sin ojo, sin adivinar).
// Uso: node scripts/verify_pose.mjs
// Criterios:
//  1. Rostro frontal sintético → yaw/pitch/roll ≈ 0
//  2. Giro a la derecha → yaw con signo correcto
//  3. F01 (A52/D18, IPD63) → lente 0.825, borde exterior llega a sienes
import { estimatePose } from "../src/components/tryon/Frame3D.js";

const N = 478;
const mk = () => Array.from({ length: N }, () => ({ x: 0.5, y: 0.5, z: 0 }));
const set = (lm, i, x, y, z = 0) => { lm[i] = { x, y, z }; };

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) fails++;
};

// Caso 1: frontal perfecto
const front = mk();
set(front, 33, 0.35, 0.4); set(front, 133, 0.45, 0.4);
set(front, 362, 0.55, 0.4); set(front, 263, 0.65, 0.4);
set(front, 168, 0.5, 0.5); set(front, 10, 0.5, 0.15); set(front, 152, 0.5, 0.8);
set(front, 234, 0.28, 0.45); set(front, 454, 0.72, 0.45);
const p1 = estimatePose(front);
check("frontal yaw≈0", Math.abs(p1.yaw) < 0.02, `yaw=${p1.yaw.toFixed(4)}rad`);
check("frontal roll≈0", Math.abs(p1.roll) < 0.02, `roll=${p1.roll.toFixed(4)}rad`);
check("frontal pitch chico", Math.abs(p1.pitch) < 0.1, `pitch=${p1.pitch.toFixed(4)}rad`);
check("frontal cx/ipd", Math.abs(p1.cx - 0.5) < 1e-9 && Math.abs(p1.ipd - 0.2) < 1e-9, `cx=${p1.cx} ipd=${p1.ipd}`);

// Caso 2: giro (ojo derecho más cerca de la nariz = cara girada a su izquierda)
const turn = mk();
set(turn, 33, 0.35, 0.4); set(turn, 133, 0.45, 0.4);
set(turn, 362, 0.56, 0.4); set(turn, 263, 0.62, 0.4);
set(turn, 168, 0.52, 0.5); set(turn, 10, 0.52, 0.15); set(turn, 152, 0.52, 0.8);
const p2 = estimatePose(turn);
check("giro yaw≠0 con signo", p2.yaw < -0.05, `yaw=${p2.yaw.toFixed(4)}rad`);

// Caso 3: tamaño F01 real (A52/B36/D18, IPD63mm)
const A = 52, B = 36, D = 18, IPD = 63;
const lensW = A / IPD, lensH = B / IPD, lensCX = (A + D) / 2 / IPD;
check("lente F01 ≈0.825", Math.abs(lensW - 0.825) < 0.005, `lensW=${lensW.toFixed(3)}`);
check("alto F01 ≈0.571", Math.abs(lensH - 0.571) < 0.005, `lensH=${lensH.toFixed(3)}`);
const outerNorm = 0.5 + (lensCX + lensW / 2) * p1.ipd; // borde exterior en coords normalizadas
const templeR = 0.72;
check("borde llega a sien", outerNorm >= templeR - 0.03, `borde=${outerNorm.toFixed(3)} sien=${templeR}`);
const innerL = 0.5 - (lensCX - lensW / 2) * p1.ipd; // borde interno lente izq
const outerL = 0.5 - (lensCX + lensW / 2) * p1.ipd; // borde externo lente izq
check("lente cubre pupila", outerL < 0.4 && 0.4 < innerL, `pupila_izq=0.40 dentro de [${outerL.toFixed(3)},${innerL.toFixed(3)}]`);

console.log(fails === 0 ? "OK: todas las verificaciones numericas" : `FALLOS: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
