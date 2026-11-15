import { Component } from "react";
import { ThemeContext } from "../../context/themeContextValue.js";
import "./ErrorBoundary.css";

/**
 * Red de seguridad de la app: si un render falla (WebGL, MediaPipe, un chunk
 * que no carga), se muestra el logo y un botón de recarga en vez de una
 * pantalla en blanco. No captura errores asíncronos; esos siguen en los hooks.
 */
export default class ErrorBoundary extends Component {
  static contextType = ThemeContext;

  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const logo = /** @type {any} */ (this.context)?.logo;

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__panel">
          {logo ? <img className="error-boundary__logo" src={logo} alt="Grupo Prisma Visión" /> : null}
          <h1 className="error-boundary__title">Algo se interrumpió</h1>
          <p className="error-boundary__text">
            No pudimos terminar de cargar esta vista. Puede ser un fallo temporal de
            WebGL o de la conexión; recargar suele resolverlo.
          </p>
          {error?.message ? (
            <p className="error-boundary__detail">{String(error.message)}</p>
          ) : null}
          <div className="error-boundary__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={this.handleReload}>
              Recargar
            </button>
            <a className="btn btn--glass btn--sm" href="/">
              Volver al inicio
            </a>
          </div>
        </div>
      </div>
    );
  }
}
