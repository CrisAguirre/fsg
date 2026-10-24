import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import GlassCard from './components/ui/GlassCard'
import { useTheme } from './context/ThemeContext'
import './App.css'

function App() {
  const { logo } = useTheme();
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

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
              Grupo Prisma Visión · Análisis facial · Beta
            </span>

            <h1 className="hero__title">
              Escaneo Facial <br />
              <span className="text-gradient">Grupo Prisma Visión</span>
            </h1>

            <p className="hero__subtitle">
              Visión por computador y modelos 3D aproximados para encontrar
              monturas compatibles con tu fisonomía, con una recomendación clara
              y orientativa.
            </p>

            <div className="hero__actions">
              <Link to="/scanner" className="btn btn--primary">
                Comenzar Escaneo
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link to="/catalogo" className="btn btn--glass">
                Explorar Catálogo
              </Link>
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
            <h2>Tecnología Óptica <span className="text-gradient">Asistida</span></h2>
            <p>Herramientas para una selección de monturas más informada</p>
          </div>

          <div className="features__grid">
            <GlassCard variant="glow">
              <div className="glass-card__icon">🔬</div>
              <h3 className="glass-card__title">Análisis Facial</h3>
              <p className="glass-card__description">
                Detección de puntos faciales y estimación de proporciones para
                recomendaciones orientativas. No es un escaneo médico ni una
                medición milimétrica.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">👓</div>
              <h3 className="glass-card__title">Ajuste Asistido</h3>
              <p className="glass-card__description">
                Reglas ópticas y un modelo de ML en fase beta que analizan la
                morfología facial para proponer monturas proporcionales.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">⚡</div>
              <h3 className="glass-card__title">Procesamiento Ágil</h3>
              <p className="glass-card__description">
                Parte del análisis ocurre en tu navegador y el resto en el
                servidor; el tiempo depende del dispositivo y de la conexión.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">📐</div>
              <h3 className="glass-card__title">Medidas Estimadas</h3>
              <p className="glass-card__description">
                Distancia pupilar, ancho facial y puente nasal aproximados,
                útiles como referencia antes de una medición en óptica.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">🛡️</div>
              <h3 className="glass-card__title">Privacidad por Defecto</h3>
              <p className="glass-card__description">
                La foto se usa solo para el análisis solicitado y no se almacena
                en el servidor. El consentimiento se solicita antes de continuar.
              </p>
            </GlassCard>

            <GlassCard variant="glow">
              <div className="glass-card__icon">🎯</div>
              <h3 className="glass-card__title">Probador Virtual</h3>
              <p className="glass-card__description">
                Superposición 3D aproximada en vivo, con seguimiento de cabeza
                y un modo 2D de respaldo cuando el dispositivo lo requiere.
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
            <p>Tres pasos para una elección más informada</p>
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
                El análisis estima proporciones de pómulos, mandíbula y frente
                para clasificar tu morfología de forma orientativa.
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
                <span className="precision__number text-gradient">BETA</span>
                <br />
                Compatibilidad orientativa
              </h2>
              <p>
                El motor combina proporciones faciales y reglas ópticas para
                ordenar las monturas. Los resultados son una guía y no sustituyen
                la valoración de un óptico.
              </p>
              <Link to="/scanner" className="btn btn--primary">
                Iniciar Escaneo Facial
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}

export default App
