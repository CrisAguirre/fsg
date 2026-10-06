import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Scanner from './pages/Scanner.jsx'
import AdminFrames from './pages/AdminFrames.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/admin/frames" element={<AdminFrames />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
