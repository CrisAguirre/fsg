import './Footer.css'
import logo from '../../assets/logo/logo.png'

function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer" id="footer">
      <div className="footer__glow" aria-hidden="true"></div>
      <div className="footer__inner container">
        <div className="footer__brand">
          <img src={logo} alt="FSG" className="footer__logo" width="32" height="32" />
          <div>
            <span className="footer__name text-gradient">Facial Scanner for Glasses</span>
            <p className="footer__tagline">Precisión 3D para tu visión perfecta</p>
          </div>
        </div>

        <div className="footer__divider"></div>

        <div className="footer__bottom">
          <p className="footer__copy">
            &copy; {currentYear} FSG. Todos los derechos reservados.
          </p>
          <p className="footer__tech text-muted">
            Powered by 3D Mesh &middot; Precision 99.8%
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
