import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
