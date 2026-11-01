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

test("la foto subida lleva al resumen con las tres cards del flujo", async ({ page }) => {
  await llegarAlResumen(page);

  await expect(page.locator(".scanner__stepcard")).toHaveCount(3);
  await expect(page.locator(".scanner__stepcard--1")).toContainText("Informe del rostro");
  await expect(page.locator(".scanner__stepcard--2")).toContainText("Monturas recomendadas");

  // El paso 3 es obligatorio pero queda bloqueado hasta probarse una montura.
  const escanear = page.getByRole("button", { name: "Escanear con montura" });
  await expect(escanear).toBeDisabled();
  await expect(escanear).toHaveAttribute("title", /probaste una montura/i);
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
