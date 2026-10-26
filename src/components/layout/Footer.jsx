import { Link } from 'react-router-dom';
import { useTheme } from '../../context/useTheme';
import './Footer.css';

const YEAR = new Date().getFullYear();

function Footer() {
  const { logo } = useTheme();

  return (
    <footer className="footer" id="footer">
      <div className="footer__glow" aria-hidden="true"></div>
      <div className="footer__inner container">
        <div className="footer__brand">
          <div className="footer__logo-box">
            <img src={logo} alt="Grupo Prisma Visión" className="footer__logo" />
          </div>
          <div>
            <span className="footer__name text-gradient">Grupo Prisma Visión</span>
            <p className="footer__tagline">Análisis facial y asesoría óptica asistida para elegir mejor tu montura</p>
          </div>
        </div>

        <div className="footer__divider"></div>

        <div className="footer__bottom">
          <p className="footer__copy">
            &copy; {YEAR} Grupo Prisma Visión. Todos los derechos reservados.
          </p>
          <p className="footer__tech text-muted">
            Glassescanner 3D &middot; Análisis facial orientativo &middot; Ajuste de monturas
            {' · '}
            <Link to="/creditos-3d">Créditos 3D (CC BY 4.0)</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
