import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import AppPreloader from './components/ui/AppPreloader.jsx'

// Rutas pesadas (Three.js/MediaPipe) fuera del bundle inicial.
const Scanner = lazy(() => import('./pages/Scanner.jsx'))
const Catalogo = lazy(() => import('./pages/Catalogo.jsx'))
const AdminFrames = lazy(() => import('./pages/AdminFrames.jsx'))
const Piloto = lazy(() => import('./pages/Piloto.jsx'))
const Creditos3D = lazy(() => import('./pages/Creditos3D.jsx'))

export default function AppRoutes() {
  return (
    <Suspense fallback={<AppPreloader variant="page" label="Cargando Glassescanner" detail="Preparando la vista…" />}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/admin/frames" element={<AdminFrames />} />
        <Route path="/piloto" element={<Piloto />} />
        <Route path="/creditos-3d" element={<Creditos3D />} />
      </Routes>
    </Suspense>
  )
}
