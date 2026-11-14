import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { registerServiceWorker } from './lib/pwa.js'
import './index.css'
import AppRoutes from './AppRoutes.jsx'

registerServiceWorker()

/** Retira el preloader estático de index.html cuando React ya pintó. */
function hideBootPreloader() {
  const boot = document.getElementById('boot-preloader')
  if (!boot) return
  boot.classList.add('boot-preloader--done')
  window.setTimeout(() => boot.remove(), 300)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)

// Dos frames: deja que React monte el árbol y el preloader de React tome el relevo.
requestAnimationFrame(() => requestAnimationFrame(hideBootPreloader))
