import { defineConfig } from "vite";

// Config temporal para capturas headless del preview GLB: sin HMR para que
// --virtual-time-budget pueda terminar.
export default defineConfig({
  server: { hmr: false },
});
