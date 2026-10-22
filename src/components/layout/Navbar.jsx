import { useTheme } from '../../context/ThemeContext';
import './Navbar.css';

function Navbar() {
  const { theme, toggleTheme, isDark, logo } = useTheme();

  return (
    <nav className="navbar" id="navbar">
      <div className="navbar__inner container">
        <a href="/" className="navbar__brand" aria-label="Grupo Prisma Visión — Glassescanner">
          <div className="navbar__logo-box">
            <img
              src={logo}
              alt="Grupo Prisma Visión"
              className="navbar__logo"
            />
          </div>
          <div className="navbar__titles">
            <span className="navbar__corp-name">GRUPO PRISMA VISIÓN</span>
            <span className="navbar__product-name text-gradient">Glassescanner 3D</span>
          </div>
        </a>

        <ul className="navbar__links">
          <li><a href="/#features">Funciones</a></li>
          <li><a href="/#how-it-works">Cómo Funciona</a></li>
          <li><a href="/catalogo">Catálogo</a></li>
          <li><a href="/scanner">Escáner Facial</a></li>
          <li><a href="/admin/frames">Admin</a></li>
        </ul>

        <div className="navbar__actions">
          {/* Botón de cambio de tema: Vista Diurna / Nocturna */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? "Cambiar a Vista Diurna" : "Cambiar a Vista Nocturna"}
            aria-label={isDark ? "Cambiar a Vista Diurna" : "Cambiar a Vista Nocturna"}
          >
            {isDark ? (
              <>
                <svg className="theme-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <span className="theme-toggle-label">Diurna</span>
              </>
            ) : (
              <>
                <svg className="theme-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span className="theme-toggle-label">Nocturna</span>
              </>
            )}
          </button>

          <a href="/scanner" className="btn btn--primary btn--sm">
            Iniciar Escaneo
          </a>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
