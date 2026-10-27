#!/usr/bin/env node
// Valida que public/glasses/manifest.json, los GLB y LICENSES.md estén
// sincronizados. Falla con código 1 si falta un archivo, una atribución o un
// campo obligatorio; los avisos no bloquean el build.
//
// Uso: npm run validate:glb

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLASSES_DIR = join(ROOT, "public", "glasses");
const MANIFEST_PATH = join(GLASSES_DIR, "manifest.json");
const LICENSES_PATH = join(GLASSES_DIR, "LICENSES.md");

const FORMAS = [
  "rectangular",
  "cuadrado",
  "redondo",
  "oval",
  "aviador",
  "wayfarer",
  "cat-eye",
  "rimless",
];

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(`No se pudo leer ${relative(ROOT, path)}: ${err.message}`);
    return null;
  }
}

const manifest = readJson(MANIFEST_PATH);
const licenses = existsSync(LICENSES_PATH) ? readFileSync(LICENSES_PATH, "utf8") : "";
if (!manifest) {
  console.error(errors.join("\n"));
  process.exit(1);
}
if (!licenses) fail("Falta public/glasses/LICENSES.md o está vacío.");

const declared = new Set(FORMAS);
const manifestKeys = Object.keys(manifest).filter((k) => !k.startsWith("_"));
for (const key of manifestKeys) {
  if (!declared.has(key)) fail(`Forma no reconocida en manifest.json: "${key}".`);
}
for (const forma of FORMAS) {
  if (!manifest[forma]) fail(`Falta la entrada "${forma}" en manifest.json.`);
}

const rows = [];
for (const forma of FORMAS) {
  const entry = manifest[forma];
  if (!entry) continue;

  if (!entry.file || typeof entry.file !== "string") {
    fail(`[${forma}] falta "file".`);
    continue;
  }
  const glbPath = join(GLASSES_DIR, entry.file);
  const exists = existsSync(glbPath) && statSync(glbPath).isFile();
  if (!exists) {
    fail(`[${forma}] no existe public/glasses/${entry.file}.`);
  }
  const sizeMB = exists ? statSync(glbPath).size / 1024 / 1024 : 0;

  if (!Array.isArray(entry.rot) || entry.rot.length !== 3 || entry.rot.some((n) => !Number.isFinite(n))) {
    fail(`[${forma}] "rot" debe ser [x, y, z] numérico.`);
  }
  if (entry.y != null && !Number.isFinite(Number(entry.y))) {
    fail(`[${forma}] "y" debe ser numérico.`);
  }
  if (entry.scale != null && (!Number.isFinite(Number(entry.scale)) || Number(entry.scale) <= 0)) {
    fail(`[${forma}] "scale" debe ser numérico > 0.`);
  }
  if (entry.targetWidth != null && (!Number.isFinite(Number(entry.targetWidth)) || Number(entry.targetWidth) <= 0)) {
    fail(`[${forma}] "targetWidth" debe ser numérico > 0.`);
  }
  if (!String(entry.license || "").toUpperCase().includes("CC-BY-4.0")) {
    fail(`[${forma}] licencia ausente o distinta de CC-BY-4.0.`);
  }
  if (!entry.author || !entry.source_url || !entry.title) {
    fail(`[${forma}] faltan author/title/source_url para la atribución.`);
  }
  for (const key of ["lensMaterials", "frameMaterials"]) {
    if (entry[key] != null && !Array.isArray(entry[key])) {
      fail(`[${forma}] "${key}" debe ser un array.`);
    }
  }

  if (licenses) {
    if (!licenses.includes(entry.file)) {
      fail(`[${forma}] LICENSES.md no menciona ${entry.file}.`);
    }
    if (entry.author && !licenses.includes(entry.author)) {
      fail(`[${forma}] LICENSES.md no atribuye a ${entry.author}.`);
    }
  }

  if (sizeMB > 3) {
    warn(`[${forma}] ${entry.file} pesa ${sizeMB.toFixed(2)} MB; revisa el impacto móvil.`);
  }

  rows.push({
    forma,
    file: entry.file,
    size: exists ? `${sizeMB.toFixed(2)} MB` : "FALTA",
    license: entry.license || "—",
    author: entry.author || "—",
  });
}

const referenced = new Set(manifestKeys.map((k) => manifest[k]?.file).filter(Boolean));
for (const file of readdirSync(GLASSES_DIR)) {
  if (file.endsWith(".glb") && !referenced.has(file)) {
    warn(`GLB sin entrada en manifest.json: ${file}.`);
  }
}

console.log("Forma        Archivo                 Peso       Licencia     Autor");
console.log("--------------------------------------------------------------------------");
for (const r of rows) {
  console.log(
    `${r.forma.padEnd(12)} ${r.file.padEnd(22)} ${r.size.padEnd(10)} ${r.license.padEnd(12)} ${r.author}`,
  );
}

if (warnings.length) {
  console.log("\nAvisos:");
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}

if (errors.length) {
  console.error("\nErrores:");
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
}

console.log(`\n✓ Manifest válido: ${FORMAS.length} formas con GLB y atribución.`);
