import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("el análisis está bloqueado hasta aceptar el consentimiento", async ({ page }) => {
  await page.goto("/scanner");
  await page.getByRole("button", { name: /Subir foto/ }).click();
  await page.locator('input[type="file"]').setInputFiles("public/frames/rectangular.jpg");

  const analyze = page.getByRole("button", { name: "Analizar compatibilidad" });
  await expect(analyze).toBeVisible();
  await expect(analyze).toBeDisabled();
  await expect(analyze).toHaveAttribute("title", /consentimiento/i);

  await page.locator(".scanner__consent input[type=checkbox]").check();
  await expect(analyze).toBeEnabled();
});

test("el escáner carga el catálogo mockeado en el selector de prueba", async ({ page }) => {
  await page.goto("/scanner");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Escáner Facial/i);

  const liveSelect = page.getByLabel("Montura para cámara en vivo");
  await expect(liveSelect).toBeVisible();
  await expect(liveSelect.locator("option")).toHaveCount(2);

  await page.getByRole("button", { name: /Subir foto/ }).click();
  await page.locator('input[type="file"]').setInputFiles("public/frames/rectangular.jpg");

  const selector = page.getByLabel("Marco para probar");
  await expect(selector).toBeVisible();
  await expect(selector.locator("option")).toHaveCount(2);
});

test("subir foto analiza y permite cambiar de montura en la misma vista", async ({ page }) => {
  await page.goto("/scanner");
  await page.locator(".scanner__consent input[type=checkbox]").check();
  await page.getByRole("button", { name: /Subir foto/ }).click();
  await page.locator('input[type="file"]').setInputFiles("public/frames/rectangular.jpg");

  // El análisis se dispara con la foto: no hace falta un segundo clic.
  const strip = page.getByRole("group", { name: "Monturas recomendadas para probar" });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole("button")).toHaveCount(2);
  await expect(page.locator(".scanner__trydetail")).toContainText("Aurora Rectangular");

  await strip.getByRole("button", { name: /Solar Redondo/ }).click();
  await expect(page.locator(".scanner__trydetail")).toContainText("Solar Redondo");
  await expect(strip.getByRole("button", { name: /Solar Redondo/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
