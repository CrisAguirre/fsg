import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import App from './App.jsx'

// Rutas pesadas (Three.js/MediaPipe) fuera del bundle inicial.
const Scanner = lazy(() => import('./pages/Scanner.jsx'))
const Catalogo = lazy(() => import('./pages/Catalogo.jsx'))
const AdminFrames = lazy(() => import('./pages/AdminFrames.jsx'))
const Piloto = lazy(() => import('./pages/Piloto.jsx'))
const Creditos3D = lazy(() => import('./pages/Creditos3D.jsx'))

export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: '7rem 1rem' }}>Cargando…</div>}>
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
