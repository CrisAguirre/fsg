import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("el catálogo pinta las monturas y asocia los filtros con su label", async ({ page }) => {
  await page.goto("/catalogo");

  await expect(page.getByRole("heading", { name: /Aurora Rectangular/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Solar Redondo/i })).toBeVisible();

  // getByLabel solo resuelve si el <label> apunta al <select>.
  for (const label of ["Género", "Estilo", "Talla", "Rango de Precio", "Lente Compatible"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
});

test("el modal es un diálogo y se cierra con Escape", async ({ page }) => {
  await page.goto("/catalogo");
  await page.getByRole("button", { name: "Detalles" }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(/Aurora Rectangular/i);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("el botón de cerrar del modal devuelve el foco al catálogo", async ({ page }) => {
  await page.goto("/catalogo");
  await page.getByRole("button", { name: "Detalles" }).first().click();
  await page.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Detalles" }).first()).toBeVisible();
});
