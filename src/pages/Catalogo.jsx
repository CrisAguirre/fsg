import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { listFrames } from '../lib/api';
import './Catalogo.css';

const FORMAS = [
  { id: 'todas', label: 'Todas' },
  { id: 'rectangular', label: 'Rectangular' },
  { id: 'cuadrado', label: 'Cuadrado' },
  { id: 'redondo', label: 'Redondo' },
  { id: 'oval', label: 'Oval' },
  { id: 'aviador', label: 'Aviador' },
  { id: 'wayfarer', label: 'Wayfarer' },
  { id: 'cat-eye', label: 'Cat-Eye' },
  { id: 'rimless', label: 'Rimless' },
];

const GENEROS = [
  { id: 'todos', label: 'Todos los géneros' },
  { id: 'unisex', label: 'Unisex' },
  { id: 'hombre', label: 'Hombre' },
  { id: 'mujer', label: 'Mujer' },
];

const ESTILOS = [
  { id: 'todos', label: 'Todos los estilos' },
  { id: 'casual', label: 'Casual' },
  { id: 'formal', label: 'Formal' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'sport', label: 'Sport' },
];

const TALLAS = [
  { id: 'todas', label: 'Todas las tallas' },
  { id: 'S', label: 'S (Pequeña)' },
  { id: 'M', label: 'M (Mediana)' },
  { id: 'L', label: 'L (Grande)' },
];

const PRECIOS = [
  { id: 'todos', label: 'Todos los precios' },
  { id: 'economico', label: '$ Económico' },
  { id: 'medio', label: '$$ Medio' },
  { id: 'premium', label: '$$$ Premium' },
];

const LENTES = [
  { id: 'todos', label: 'Cualquier tipo de lente' },
  { id: 'monofocal', label: 'Monofocal' },
  { id: 'bifocal', label: 'Bifocal' },
  { id: 'progresivo', label: 'Progresivo' },
  { id: 'blue-cut', label: 'Filtro Luz Azul (Blue-Cut)' },
  { id: 'fotocromático', label: 'Fotocromático' },
  { id: 'polarizado', label: 'Polarizado' },
];

export default function Catalogo() {
  const navigate = useNavigate();
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [forma, setForma] = useState('todas');
  const [genero, setGenero] = useState('todos');
  const [estilo, setEstilo] = useState('todos');
  const [talla, setTalla] = useState('todas');
  const [precio, setPrecio] = useState('todos');
  const [tipoLente, setTipoLente] = useState('todos');
  const [selectedFrame, setSelectedFrame] = useState(null);

  useEffect(() => {
    let active = true;
    listFrames()
      .then((data) => {
        if (active) {
          setFrames(data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredFrames = useMemo(() => {
    return frames.filter((f) => {
      if (forma !== 'todas' && f.forma !== forma) return false;
      if (genero !== 'todos' && f.genero !== genero && f.genero !== 'unisex') return false;
      if (estilo !== 'todos' && f.estilo !== estilo) return false;
      if (talla !== 'todas' && f.talla !== talla) return false;
      if (precio !== 'todos' && f.precio_rango !== precio) return false;
      if (tipoLente !== 'todos' && (!f.tipo_lente || !f.tipo_lente.includes(tipoLente))) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesNombre = f.nombre?.toLowerCase().includes(q);
        const matchesMarca = f.marca?.toLowerCase().includes(q);
        const matchesForma = f.forma?.toLowerCase().includes(q);
        const matchesColor = f.color?.toLowerCase().includes(q);
        const matchesMat = f.material?.toLowerCase().includes(q);
        if (!matchesNombre && !matchesMarca && !matchesForma && !matchesColor && !matchesMat) {
          return false;
        }
      }
      return true;
    });
  }, [frames, forma, genero, estilo, talla, precio, tipoLente, search]);

  const resetFilters = () => {
    setSearch('');
    setForma('todas');
    setGenero('todos');
    setEstilo('todos');
    setTalla('todas');
    setPrecio('todos');
    setTipoLente('todos');
  };

  const handleProbar = (frameId) => {
    navigate(`/scanner?frameId=${frameId}`);
  };

  return (
    <>
      <Navbar />

      <main className="catalogo-page container">
        {/* ── Header ─────────────────────────────────────────── */}
        <section className="catalogo-hero">
          <div className="catalogo-hero__badge glass">
            <span className="dot-pulse"></span>
            Stock Oficial · {frames.length || 64} Modelos Disponibles
          </div>
          <h1 className="catalogo-hero__title">
            Catálogo de <span className="text-gradient">Monturas y Lentes</span>
          </h1>
          <p className="catalogo-hero__subtitle">
            Explora nuestra colección calibrada para todo tipo de geometrías faciales.
            Selecciona cualquier modelo y pruébalo en tiempo real con nuestro escáner facial 3D.
          </p>
        </section>

        {/* ── Filtros y Búsqueda ─────────────────────────────── */}
        <section className="catalogo-controls glass--heavy">
          <div className="catalogo-search-row">
            <div className="catalogo-search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="catalogo-search-input"
                placeholder="Buscar por modelo, marca (OptiVision, Lumen, Vertex), color o material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="search-clear-btn" onClick={() => setSearch('')}>✕</button>
              )}
            </div>

            <div className="catalogo-count-badge">
              Mostrando <b>{filteredFrames.length}</b> de {frames.length} monturas
            </div>
          </div>

          {/* Formas Tabs */}
          <div className="catalogo-shapes-tabs" role="tablist" aria-label="Filtro por forma de montura">
            {FORMAS.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={forma === item.id}
                className={`shape-tab-btn ${forma === item.id ? 'active' : ''}`}
                onClick={() => setForma(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Dropdowns secundarios */}
          <div className="catalogo-dropdowns-grid">
            <div className="filter-group">
              <label>Género</label>
              <select value={genero} onChange={(e) => setGenero(e.target.value)}>
                {GENEROS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label>Estilo</label>
              <select value={estilo} onChange={(e) => setEstilo(e.target.value)}>
                {ESTILOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label>Talla</label>
              <select value={talla} onChange={(e) => setTalla(e.target.value)}>
                {TALLAS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label>Rango de Precio</label>
              <select value={precio} onChange={(e) => setPrecio(e.target.value)}>
                {PRECIOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label>Lente Compatible</label>
              <select value={tipoLente} onChange={(e) => setTipoLente(e.target.value)}>
                {LENTES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {(forma !== 'todas' || genero !== 'todos' || estilo !== 'todos' || talla !== 'todas' || precio !== 'todos' || tipoLente !== 'todos' || search) && (
            <div className="catalogo-reset-row">
              <button className="btn btn--glass btn--sm" onClick={resetFilters}>
                ↺ Restablecer todos los filtros
              </button>
            </div>
          )}
        </section>

        {/* ── Grid de Monturas ─────────────────────────────────── */}
        {loading ? (
          <div className="catalogo-loading glass">
            <div className="dot-pulse"></div>
            <p>Cargando catálogo oficial de monturas...</p>
          </div>
        ) : filteredFrames.length === 0 ? (
          <div className="catalogo-empty glass--heavy">
            <span className="empty-icon">👓</span>
            <h3>No encontramos monturas con estos filtros</h3>
            <p>Prueba ajustando los criterios de búsqueda o limpiando los filtros seleccionados.</p>
            <button className="btn btn--primary" onClick={resetFilters}>
              Ver todas las monturas
            </button>
          </div>
        ) : (
          <section className="catalogo-grid">
            {filteredFrames.map((f) => (
              <article key={f.id} className="catalogo-card glass">
                <div className="catalogo-card__header">
                  <div className="card-badge-row">
                    <span className="badge-shape">{f.forma}</span>
                    <span className="badge-brand">{f.marca || 'OptiVision'}</span>
                  </div>
                  <span className={`badge-tier tier--${f.precio_rango || 'medio'}`}>
                    {f.precio_rango === 'premium' ? '$$$ Premium' : f.precio_rango === 'economico' ? '$ Económico' : '$$ Medio'}
                  </span>
                </div>

                <div className="catalogo-card__visual">
                  <div className="frame-icon-display">
                    <img
                      src={f.imagen_url || `/frames/${f.forma}.jpg`}
                      alt={f.nombre}
                      className="catalogo-card__img"
                      loading="lazy"
                      onError={(e) => { e.target.src = ''; e.target.alt = '👓'; e.target.className = 'catalogo-card__img-fallback'; }}
                    />
                    <span className="frame-id-tag">{f.id}</span>
                  </div>
                </div>

                <div className="catalogo-card__body">
                  <h3 className="card-frame-title">{f.nombre}</h3>

                  <div className="card-meta-tags">
                    <span className="meta-tag">{f.estilo || 'casual'}</span>
                    <span className="meta-tag">Talla {f.talla || 'M'}</span>
                    <span className="meta-tag">{f.genero || 'unisex'}</span>
                    <span className="meta-tag">{f.material || 'acetato'}</span>
                    <span className="meta-tag meta-color">{f.color || 'negro'}</span>
                  </div>

                  {/* Medidas Técnicas Ópticas */}
                  <div className="card-measurements">
                    <div className="measure-item" title="Calibre / Ancho del lente">
                      <span className="measure-lbl">A (Lente)</span>
                      <span className="measure-num">{f.A_mm} mm</span>
                    </div>
                    <div className="measure-item" title="Altura del lente">
                      <span className="measure-lbl">B (Alto)</span>
                      <span className="measure-num">{f.B_mm} mm</span>
                    </div>
                    <div className="measure-item" title="Puente nasal">
                      <span className="measure-lbl">D (Puente)</span>
                      <span className="measure-num">{f.D_mm} mm</span>
                    </div>
                    <div className="measure-item" title="Ancho total frontal">
                      <span className="measure-lbl">Ancho Total</span>
                      <span className="measure-num highlight">{f.ancho_total_mm} mm</span>
                    </div>
                  </div>

                  {/* Compatibilidad de Lentes */}
                  {f.tipo_lente && f.tipo_lente.length > 0 && (
                    <div className="card-lentes-section">
                      <span className="lentes-title">Lentes compatibles:</span>
                      <div className="lentes-pills">
                        {f.tipo_lente.map((t) => (
                          <span key={t} className="lente-pill">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="catalogo-card__footer">
                  <button
                    className="btn btn--glass btn--sm"
                    onClick={() => setSelectedFrame(f)}
                  >
                    Detalles
                  </button>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => handleProbar(f.id)}
                  >
                    Probar con Escáner ⚡
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* ── Modal de Detalle de Montura ──────────────────────── */}
        {selectedFrame && (
          <div className="catalogo-modal-backdrop" onClick={() => setSelectedFrame(null)}>
            <div className="catalogo-modal glass--heavy" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setSelectedFrame(null)}>✕</button>

              <div className="modal-header">
                <span className="badge-shape">{selectedFrame.forma}</span>
                <h2>{selectedFrame.nombre}</h2>
                <p className="modal-sub">Código: <b>{selectedFrame.id}</b> · Marca: <b>{selectedFrame.marca}</b></p>
              </div>

              <div className="modal-specs-grid">
                <div className="modal-spec-card">
                  <span className="spec-label">Ancho Total Montura</span>
                  <span className="spec-val">{selectedFrame.ancho_total_mm} mm</span>
                </div>
                <div className="modal-spec-card">
                  <span className="spec-label">Calibre Lente (A)</span>
                  <span className="spec-val">{selectedFrame.A_mm} mm</span>
                </div>
                <div className="modal-spec-card">
                  <span className="spec-label">Altura Lente (B)</span>
                  <span className="spec-val">{selectedFrame.B_mm} mm</span>
                </div>
                <div className="modal-spec-card">
                  <span className="spec-label">Puente Nasal (D)</span>
                  <span className="spec-val">{selectedFrame.D_mm} mm</span>
                </div>
                <div className="modal-spec-card">
                  <span className="spec-label">Largo de Patilla</span>
                  <span className="spec-val">{selectedFrame.patilla_mm || 140} mm</span>
                </div>
                <div className="modal-spec-card">
                  <span className="spec-label">Material y Acabado</span>
                  <span className="spec-val">{selectedFrame.material} · {selectedFrame.color}</span>
                </div>
              </div>

              {selectedFrame.tipo_lente && (
                <div className="modal-lentes">
                  <h4>Tipos de Lente Soportados Técnicamente:</h4>
                  <div className="lentes-pills">
                    {selectedFrame.tipo_lente.map((t) => (
                      <span key={t} className="lente-pill-lg">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="btn btn--primary"
                  onClick={() => handleProbar(selectedFrame.id)}
                >
                  Probar este modelo en mi rostro con el Escáner 3D
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
