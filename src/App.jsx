import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import GlassCard from './components/ui/GlassCard'
import { useTheme } from './context/ThemeContext'
import './App.css'

function App() {
  const { logo, isDark } = useTheme();

  return (
    <>
      <Navbar />

      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="hero" id="start">
        <div className="hero__bg-orb hero__bg-orb--primary" aria-hidden="true"></div>
        <div className="hero__bg-orb hero__bg-orb--secondary" aria-hidden="true"></div>
        <div className="hero__grid-lines" aria-hidden="true"></div>

        <div className="hero__inner container">
          <div className="hero__content animate-fade-in-up">
            <span className="hero__badge glass">
              <span className="hero__badge-dot"></span>
              Grupo Prisma Visión · Biometría 3D · Precisión 99.8%
            </span>

            <h1 className="hero__title">
              Escaneo Facial <br />
              <span className="text-gradient">Grupo Prisma Visión</span>
            </h1>

            <p className="hero__subtitle">
              Tecnología óptica de vanguardia y mapeo biométrico tridimensional
              para encontrar la montura perfecta adaptada exactamente a tu fisonomía.
            </p>

            <div className="hero__actions">
              <a href="/scanner" className="btn btn--primary">
                Comenzar Escaneo
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a href="/catalogo" className="btn btn--glass">
                Explorar Catálogo
              </a>
            </div>
          </div>

          <div className="hero__visual animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="hero__logo-wrapper">
              <div className="hero__logo-glow" aria-hidden="true"></div>
              <div className="hero__logo-card glass">
                <img
                  src={logo}
                  alt="Grupo Prisma Visión Logo"
                  className="hero__logo-img"
                  width="420"
                  height="420"
                />
              </div>
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
            <span className="section-label text-gradient">Funciones Corporativas</span>
            <h2>Tecnología Óptica de <span className="text-gradient">Vanguardia</span></h2>
            <p>Ecosistema integral para la selección y calibración exacta de monturas</p>
          </div>

          <div className="features__grid">
            <GlassCard variant="glow">
              <div className="glass-card__icon">🔬</div>
              <h3 className="glass-card__title">Escaneo 3D</h3>
              <p className="glass-card__description">
                Mapeo facial tridimensional con malla de puntos anatómica
                para mediciones submilimétricas de máxima exactitud.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">👓</div>
              <h3 className="glass-card__title">Ajuste de Precisión</h3>
              <p className="glass-card__description">
                Algoritmos ópticos y ML que analizan la morfología facial para
                recomendar monturas proporcionales y estéticas.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">⚡</div>
              <h3 className="glass-card__title">Tiempo Real</h3>
              <p className="glass-card__description">
                Procesamiento instantáneo en navegador con retroalimentación
                inmediata en menos de 2 segundos.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">📐</div>
              <h3 className="glass-card__title">Mediciones Ópticas</h3>
              <p className="glass-card__description">
                Distancia pupilar (DIP), ancho nasal, largo de patilla
                y parámetros geométricos clave para optometría.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">🛡️</div>
              <h3 className="glass-card__title">Privacidad Estricta</h3>
              <p className="glass-card__description">
                Tratamiento seguro de imagen biométrica conforme a la normativa
                de protección de datos y consentimiento explícito.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">🎯</div>
              <h3 className="glass-card__title">Probador Virtual AR</h3>
              <p className="glass-card__description">
                Superposición 3D interactiva en vivo con iluminación calibrada
                y seguimiento de cabeza en tiempo real.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* ── How it Works ──────────────────────────────────────── */}
      <section className="how-it-works" id="how-it-works">
        <div className="container">
          <div className="section-header">
            <span className="section-label text-gradient">Proceso Óptico</span>
            <h2>Cómo <span className="text-gradient">Funciona</span></h2>
            <p>Tres pasos intuitivos hacia tu elección visual perfecta</p>
          </div>

          <div className="steps">
            <div className="step glass">
              <div className="step__number text-gradient">01</div>
              <h3 className="step__title">Posiciona</h3>
              <p className="step__description">
                Centra tu rostro frente a la cámara o sube una fotografía.
                El sistema detectará automáticamente los puntos clave.
              </p>
            </div>

            <div className="step__connector" aria-hidden="true">
              <div className="step__connector-line"></div>
            </div>

            <div className="step glass">
              <div className="step__number text-gradient">02</div>
              <h3 className="step__title">Escanea</h3>
              <p className="step__description">
                La malla facial analiza proporciones de pómulos, mandíbula
                y frente para clasificar tu morfología.
              </p>
            </div>

            <div className="step__connector" aria-hidden="true">
              <div className="step__connector-line"></div>
            </div>

            <div className="step glass">
              <div className="step__number text-gradient">03</div>
              <h3 className="step__title">Resultados</h3>
              <p className="step__description">
                Explora el ranking de compatibilidad de Grupo Prisma Visión
                y pruébate las monturas en tiempo real.
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
                Precisión y Confort
              </h2>
              <p>
                El motor de análisis biométrico de Grupo Prisma Visión garantiza
                que cada recomendación se alinee armónicamente con tus facciones
                y necesidades visuales.
              </p>
              <a href="/scanner" className="btn btn--primary">
                Iniciar Escaneo Facial
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
