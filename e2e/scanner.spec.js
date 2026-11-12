import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

/** Recorre inicio → consentimiento → subida de foto hasta el resumen. */
async function llegarAlResumen(page) {
  await page.goto("/scanner");
  await page.getByRole("button", { name: "Iniciar escaneo" }).click();
  await page.locator(".scanner__consent input[type=checkbox]").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Subir foto/ }).click();
  await page.locator('input[type="file"]').setInputFiles("public/frames/rectangular.jpg");
  await expect(page.locator(".scanner__hub")).toBeVisible();
}

test("el escaneo no avanza sin aceptar el consentimiento", async ({ page }) => {
  await page.goto("/scanner");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Escáner Facial/i);

  await page.getByRole("button", { name: "Iniciar escaneo" }).click();
  const continuar = page.getByRole("button", { name: "Continuar" });
  await expect(continuar).toBeDisabled();

  await page.locator(".scanner__consent input[type=checkbox]").check();
  await expect(continuar).toBeEnabled();
});

test("la foto subida lleva al resumen con las cuatro cards del flujo", async ({ page }) => {
  await llegarAlResumen(page);

  await expect(page.locator(".scanner__stepcard")).toHaveCount(4);
  await expect(page.locator(".scanner__stepcard--1")).toContainText("Informe del rostro");
  await expect(page.locator(".scanner__stepcard--2")).toContainText("Monturas recomendadas");
  await expect(page.locator(".scanner__stepcard--4")).toContainText("Probador virtual");

  // El paso 3 es obligatorio pero queda bloqueado hasta probarse una montura.
  const escanear = page.getByRole("button", { name: "Escanear con montura" });
  await expect(escanear).toBeDisabled();
  await expect(escanear).toHaveAttribute("title", /probaste una montura/i);
});

test("la cuarta card abre el probador virtual independiente", async ({ page }) => {
  await llegarAlResumen(page);
  await page.getByRole("button", { name: "Abrir probador" }).click();

  const studio = page.locator(".tryon");
  await expect(studio).toBeVisible();
  await expect(studio).toContainText("Servicio alterno");
  await expect(studio).toContainText("No requiere el escaneo facial");
  await expect(studio).toContainText("sin análisis de compatibilidad");
  await expect(page.getByRole("button", { name: /Cámara en vivo/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Foto o captura/ })).toBeVisible();

  await page.getByRole("button", { name: "← Volver" }).click();
  await expect(page.locator(".scanner__hub")).toBeVisible();
});

test("el probador independiente monta una foto y permite elegir 2D/3D", async ({ page }) => {
  await page.goto("/scanner");
  await page.getByRole("button", { name: /Probar monturas sin escanear/ }).click();

  // Servicio independiente: su propio consentimiento, sin pasar por el escaneo.
  await page.locator(".tryon__consent input[type=checkbox]").check();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: /Foto o captura/ }).click();
  await page.locator('.tryon input[type="file"]').setInputFiles("public/frames/rectangular.jpg");

  await expect(page.locator(".tryon .scanner__zoomwrap")).toBeVisible();
  await expect(page.locator(".scanner__trydetail")).toContainText("Aurora Rectangular");

  const twoD = page.getByRole("button", { name: "2D", exact: true });
  const threeD = page.getByRole("button", { name: "3D real", exact: true });
  await twoD.click();
  await expect(twoD).toHaveAttribute("aria-pressed", "true");
  await threeD.click();
  await expect(threeD).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Montura para el probador").selectOption("F02");
  await expect(page.locator(".scanner__trydetail")).toContainText("Solar Redondo");
});

test("el probador en vivo enciende la cámara y captura una foto", async ({ page }) => {
  await page.goto("/scanner");
  await page.getByRole("button", { name: /Probar monturas sin escanear/ }).click();
  await page.locator(".tryon__consent input[type=checkbox]").check();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: /Activar cámara/ }).click();
  const video = page.locator(".tryon video");
  await expect(video).toBeVisible();
  await expect.poll(async () => video.evaluate((v) => v.videoWidth)).toBeGreaterThan(0);

  await page.getByRole("button", { name: /Capturar y probar en foto/ }).click();
  await expect(page.locator(".tryon .scanner__zoomwrap")).toBeVisible();
  await expect(page.locator(".scanner__trydetail")).toContainText("Aurora Rectangular");
});

test("el informe se abre membreteado y con compatibilidad por tipo", async ({ page }) => {
  await llegarAlResumen(page);
  await page.getByRole("button", { name: "Ver informe" }).click();

  const doc = page.locator(".report-doc");
  await expect(doc).toBeVisible();
  await expect(doc).toContainText("Grupo Prisma Visión");
  await expect(doc).toContainText("Forma confirmada");
  await expect(doc).toContainText("Ovalado");
  await expect(doc).toContainText("Forma de montura");
  await expect(doc).toContainText("Tipo de lente");
  await expect(doc).toContainText("monturas con mayor compatibilidad");

  // Galería de producto: fotos independientes, no montadas sobre la foto.
  const productGallery = doc.locator(".report__frames");
  await expect(productGallery).toBeVisible();
  await expect(productGallery.locator(".report__frame-card")).toHaveCount(2);
  await expect(productGallery.locator("img").first()).toBeVisible();

  // Registro visual: la foto original aparece primero; los montajes dependen de
  // que MediaPipe detecte un rostro (la imagen de prueba es un producto).
  const gallery = doc.locator(".report__visual");
  await expect(gallery).toBeVisible();
  await expect(gallery.getByAltText("Fotografía original del rostro escaneado")).toBeVisible();

  await expect(page.getByRole("button", { name: /Descargar PDF/ })).toBeVisible();

  await page.getByRole("button", { name: /Cerrar/ }).click();
  await expect(page.locator(".scanner__hub")).toBeVisible();
});

test("monturas, prueba física y escaneo con montura cierran el flujo", async ({ page }) => {
  await llegarAlResumen(page);
  await page.getByRole("button", { name: "Ver monturas" }).click();

  const strip = page.getByRole("group", { name: "Monturas recomendadas para probar" });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole("button")).toHaveCount(2);
  await expect(page.locator(".scanner__trydetail")).toContainText("Aurora Rectangular");

  await strip.getByRole("button", { name: /Solar Redondo/ }).click();
  await expect(page.locator(".scanner__trydetail")).toContainText("Solar Redondo");

  await page.getByRole("button", { name: /Me la probé/ }).click();
  await expect(page.locator(".scanner__fitbar")).toContainText("Solar Redondo");

  await page.getByRole("button", { name: /Subir foto/ }).click();
  await page.locator('input[type="file"]').setInputFiles("public/frames/rectangular.jpg");

  const fit = page.locator(".report-doc");
  await expect(fit).toBeVisible();
  await expect(fit).toContainText("Montura evaluada");
  await expect(fit).toContainText("Solar Redondo");
  await expect(fit).toContainText("Centrado óptico");
});
