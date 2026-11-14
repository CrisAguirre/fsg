import { useTheme } from "../../context/useTheme";
import "./AppPreloader.css";

/**
 * Preloader corporativo reutilizable (logo + mensaje + progreso/animación).
 * @param {{
 *   variant?: "overlay" | "page" | "inline",
 *   label?: string,
 *   detail?: string,
 *   progress?: number | null,
 *   onSkip?: (() => void) | null,
 *   skipLabel?: string,
 *   className?: string,
 * }} props
 */
export default function AppPreloader({
  variant = "page",
  label = "Cargando…",
  detail = "",
  progress = null,
  onSkip = null,
  skipLabel = "Continuar sin esperar",
  className = "",
}) {
  const { logo } = useTheme();
  const percent = typeof progress === "number"
    ? Math.max(0, Math.min(100, progress))
    : null;

  return (
    <div
      className={`app-preloader app-preloader--${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-preloader__panel">
        <div className="app-preloader__logo" aria-hidden="true">
          <span className="app-preloader__halo" />
          <img src={logo} alt="" width="120" height="120" />
          <span className="app-preloader__ring" />
        </div>

        <p className="app-preloader__label">{label}</p>
        {detail ? <p className="app-preloader__detail">{detail}</p> : null}

        {percent === null ? (
          <span className="app-preloader__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : (
          <div
            className="app-preloader__progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-label={label}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        )}

        {onSkip ? (
          <button type="button" className="btn btn--glass btn--sm app-preloader__skip" onClick={onSkip}>
            {skipLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
