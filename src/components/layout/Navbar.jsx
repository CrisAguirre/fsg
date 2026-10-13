import './Navbar.css'
import logo from '../../assets/logo/logo.png'

function Navbar() {
  return (
    <nav className="navbar glass" id="navbar">
      <div className="navbar__inner container">
        <a href="/" className="navbar__brand" aria-label="Glassescanner — Inicio">
          <img
            src={logo}
            alt="Glassescanner Logo"
            className="navbar__logo"
            width="40"
            height="40"
          />
          <span className="navbar__wordmark">
            <span className="text-gradient">Glassescanner</span>
          </span>
        </a>

        <ul className="navbar__links">
          <li><a href="/#features">Funciones</a></li>
          <li><a href="/#how-it-works">Cómo funciona</a></li>
          <li><a href="/catalogo">Catálogo</a></li>
          <li><a href="/scanner">Escáner</a></li>
          {/* Piloto oculto: módulo experimental, fuera de la presentación inicial */}
          <li><a href="/admin/frames">Admin</a></li>
        </ul>

        <div className="navbar__actions">
          <a href="/scanner" className="btn btn--primary btn--sm">
            Iniciar Escaneo
          </a>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
