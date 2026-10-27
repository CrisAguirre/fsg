import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend remoto. El deploy de Render no incluye los orígenes locales en su
// allowlist CORS, así que en desarrollo se pasa por este proxy: el navegador
// pide al propio dev server (mismo origen) y Vite reenvía a la API.
const API_TARGET = process.env.VITE_API_PROXY || 'https://glassescanner-backend.onrender.com'

const apiProxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: {
    rolldownOptions: {
      output: {
        // Three.js se descarga solo cuando el probador 3D se activa.
        // Se separa del código de la app y se parte si supera ~420 kB.
        codeSplitting: {
          maxSize: 420 * 1024,
          groups: [
            {
              name: 'three',
              test: /node_modules[\\/]three/,
            },
          ],
        },
      },
    },
  },
})
