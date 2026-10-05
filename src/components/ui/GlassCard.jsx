import './GlassCard.css'

/**
 * GlassCard — Tarjeta con efecto aeroglass/glassmorphism
 * @param {object}  props
 * @param {string}  [props.variant]   - 'default' | 'accent' | 'glow'
 * @param {string}  [props.className] - CSS classes adicionales
 * @param {React.ReactNode} props.children
 */
function GlassCard({ variant = 'default', className = '', children, ...rest }) {
  return (
    <div
      className={`glass-card glass-card--${variant} ${className}`}
      {...rest}
    >
      <div className="glass-card__shine" aria-hidden="true"></div>
      <div className="glass-card__content">
        {children}
      </div>
    </div>
  )
}

export default GlassCard
