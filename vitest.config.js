import { defineConfig } from "vitest/config";

// Los specs de Playwright viven en `e2e/` y no deben ejecutarse con Vitest.
export default defineConfig({
  test: {
    include: ["src/**/*.test.js"],
  },
});
