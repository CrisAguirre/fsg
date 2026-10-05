import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import GlassCard from './components/ui/GlassCard'
import logoIcon from './assets/logo/logo.png'
import './App.css'

function App() {
  return (
    <>
      <Navbar />

      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="hero" id="start">
        <div className="hero__bg-orb hero__bg-orb--cyan" aria-hidden="true"></div>
        <div className="hero__bg-orb hero__bg-orb--magenta" aria-hidden="true"></div>
        <div className="hero__grid-lines" aria-hidden="true"></div>

        <div className="hero__inner container">
          <div className="hero__content animate-fade-in-up">
            <span className="hero__badge glass">
              <span className="hero__badge-dot"></span>
              3D Mesh Active · Precision 99.8%
            </span>

            <h1 className="hero__title">
              Escaneo Facial <br />
              <span className="text-gradient">de Precisión</span>
            </h1>

            <p className="hero__subtitle">
              Tecnología avanzada de mapeo facial 3D para encontrar
              las gafas perfectas para tu rostro. Análisis completo
              en segundos.
            </p>

            <div className="hero__actions">
              <a href="#features" className="btn btn--primary">
                Comenzar Escaneo
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a href="#how-it-works" className="btn btn--glass">
                Cómo funciona
              </a>
            </div>
          </div>

          <div className="hero__visual animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="hero__logo-wrapper">
              <div className="hero__logo-glow" aria-hidden="true"></div>
              <img
                src={logoIcon}
                alt="FSG Logo"
                className="hero__logo-img"
                width="420"
                height="420"
              />
              <div className="hero__logo-ring" aria-hidden="true"></div>
              <div className="hero__logo-ring hero__logo-ring--outer" aria-hidden="true"></div>
            </div>
          </div>
        </div>

        <div className="hero__scroll-indicator" aria-hidden="true">
          <div className="hero__scroll-line"></div>
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────────── */}
      <section className="features" id="features">
        <div className="container">
          <div className="section-header">
            <span className="section-label text-gradient">Funciones</span>
            <h2>Tecnología de <span className="text-gradient">Vanguardia</span></h2>
            <p>Todo lo que necesitas para el ajuste perfecto de gafas</p>
          </div>

          <div className="features__grid">
            <GlassCard variant="glow">
              <div className="glass-card__icon">🔬</div>
              <h3 className="glass-card__title">Escaneo 3D</h3>
              <p className="glass-card__description">
                Mapeo facial tridimensional con malla de puntos de alta densidad
                para mediciones submilimétricas.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">👓</div>
              <h3 className="glass-card__title">Ajuste Perfecto</h3>
              <p className="glass-card__description">
                Algoritmos de IA que analizan la geometría facial para
                recomendar monturas ideales.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">⚡</div>
              <h3 className="glass-card__title">Tiempo Real</h3>
              <p className="glass-card__description">
                Procesamiento instantáneo con resultados de precisión
                del 99.8% en menos de 3 segundos.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">📐</div>
              <h3 className="glass-card__title">Mediciones</h3>
              <p className="glass-card__description">
                Distancia pupilar, ancho de puente, largo de patilla
                y más de 20 métricas faciales.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">🛡️</div>
              <h3 className="glass-card__title">Privacidad</h3>
              <p className="glass-card__description">
                Todo el procesamiento ocurre localmente.
                Tus datos biométricos nunca salen de tu dispositivo.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">🎯</div>
              <h3 className="glass-card__title">Facial Map</h3>
              <p className="glass-card__description">
                Mapa facial completo con puntos de referencia anatómicos
                para un análisis detallado y personalizado.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* ── How it Works ──────────────────────────────────────── */}
      <section className="how-it-works" id="how-it-works">
        <div className="container">
          <div className="section-header">
            <span className="section-label text-gradient">Proceso</span>
            <h2>Cómo <span className="text-gradient">Funciona</span></h2>
            <p>Tres simples pasos para tu escaneo perfecto</p>
          </div>

          <div className="steps">
            <div className="step glass">
              <div className="step__number text-gradient">01</div>
              <h3 className="step__title">Posiciona</h3>
              <p className="step__description">
                Centra tu rostro frente a la cámara.
                El sistema detectará automáticamente tu posición.
              </p>
            </div>

            <div className="step__connector" aria-hidden="true">
              <div className="step__connector-line"></div>
            </div>

            <div className="step glass">
              <div className="step__number text-gradient">02</div>
              <h3 className="step__title">Escanea</h3>
              <p className="step__description">
                La malla 3D mapea más de 1,000 puntos faciales
                en tiempo real con máxima precisión.
              </p>
            </div>

            <div className="step__connector" aria-hidden="true">
              <div className="step__connector-line"></div>
            </div>

            <div className="step glass">
              <div className="step__number text-gradient">03</div>
              <h3 className="step__title">Resultados</h3>
              <p className="step__description">
                Obtén tus medidas faciales y recomendaciones
                de monturas en segundos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Precision CTA ─────────────────────────────────────── */}
      <section className="precision" id="precision">
        <div className="container">
          <div className="precision__card glass--heavy">
            <div className="precision__glow" aria-hidden="true"></div>
            <div className="precision__content">
              <h2>
                <span className="precision__number text-gradient">99.8%</span>
                <br />
                de Precisión
              </h2>
              <p>
                Nuestro motor de escaneo 3D alcanza una precisión submilimétrica,
                garantizando que cada montura recomendada se ajuste perfectamente
                a la anatomía de tu rostro.
              </p>
              <a href="#start" className="btn btn--primary">
                Probar Ahora
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}

export default App
