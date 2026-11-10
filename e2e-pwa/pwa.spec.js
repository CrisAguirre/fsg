import { expect, test } from "@playwright/test";

test("el PWA registra el service worker y sirve el shell offline", async ({ page, context }) => {
  test.setTimeout(120_000);

  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const ready = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: registration.scope, active: Boolean(registration.active) };
  });
  expect(ready.active).toBe(true);
  expect(ready.scope).toBe("http://localhost:4173/");

  // La primera carga no está controlada; tras recargar, el SW toma el control.
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  // Sin red, la navegación debe resolver con el index.html cacheado.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("body")).toContainText(/Prisma|Glassescanner/i);
  await context.setOffline(false);
});
