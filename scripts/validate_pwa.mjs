// Valida que el PWA tenga manifiesto instalable, iconos presentes y un service
// worker con los eventos mínimos. Se ejecuta con `npm run validate:pwa`.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

const manifestPath = path.join(root, "public", "manifest.webmanifest");
if (!existsSync(manifestPath)) {
  problems.push("falta public/manifest.webmanifest");
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.display !== "standalone") problems.push("display debe ser standalone");
  if (manifest.start_url !== "/") problems.push("start_url debe ser /");
  if (manifest.scope !== "/") problems.push("scope debe ser /");

  const icons = manifest.icons ?? [];
  const sizes = icons.map((icon) => icon.sizes);
  if (!sizes.includes("192x192")) problems.push("falta icono 192x192");
  if (!sizes.includes("512x512")) problems.push("falta icono 512x512");
  if (!icons.some((icon) => icon.purpose === "maskable")) {
    problems.push("falta icono maskable");
  }
  for (const icon of icons) {
    const file = path.join(root, "public", icon.src.replace(/^\//, ""));
    if (!existsSync(file)) problems.push(`falta el archivo del icono ${icon.src}`);
  }
}

const swPath = path.join(root, "public", "sw.js");
if (!existsSync(swPath)) {
  problems.push("falta public/sw.js");
} else {
  const sw = readFileSync(swPath, "utf8");
  for (const token of ["install", "activate", "fetch", "VERSION"]) {
    if (!sw.includes(token)) problems.push(`public/sw.js no contiene ${token}`);
  }
}

if (problems.length > 0) {
  console.error("PWA inválida:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log("✓ PWA válida: manifest, iconos 192/512/maskable y service worker.");
