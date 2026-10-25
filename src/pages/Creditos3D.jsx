import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import './Creditos3D.css';

const ORDEN = ['rectangular', 'cuadrado', 'redondo', 'oval', 'aviador', 'wayfarer', 'cat-eye', 'rimless'];

function Creditos3D() {
  const [credits, setCredits] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/glasses/manifest.json', { cache: 'force-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        const entries = ORDEN
          .filter((forma) => data?.[forma])
          .map((forma) => ({ forma, ...data[forma] }));
        setCredits(entries);
      })
      .catch(() => {
        if (alive) setError('No se pudo cargar el manifest de modelos 3D.');
      });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <Navbar />
      <main className="credits container">
        <header className="credits__header">
          <h1>Créditos de los <span className="text-gradient">modelos 3D</span></h1>
          <p>
            Las monturas del probador virtual son obras de terceros distribuidas
            bajo <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">Creative Commons Atribución 4.0 (CC BY 4.0)</a>.
            Grupo Prisma Visión las adapta para el try-on; la licencia no implica
            respaldo de los autores.
          </p>
          <p className="credits__note">
            Los archivos se normalizan en tiempo de ejecución (centrado, rotación,
            escala por IPD y ajuste de materiales). La geometría original no se
            modifica en disco. Atribuciones completas en{' '}
            <a href="/glasses/LICENSES.md">LICENSES.md</a>.
          </p>
        </header>

        {error && <p className="scanner__error">{error}</p>}

        <div className="credits__grid">
          {credits.map((item) => (
            <article className="glass credits__card" key={item.forma}>
              <div className="credits__card-head">
                <span className="tag tag--highlight">{item.forma}</span>
                <span className="tag">CC BY 4.0</span>
              </div>
              <h2>{item.title || item.file}</h2>
              <p className="credits__author">
                Autor:{' '}
                {item.author_url
                  ? <a href={item.author_url} target="_blank" rel="noopener noreferrer">{item.author || 'enlace'}</a>
                  : (item.author || 'sin dato')}
              </p>
              {item.source_url && (
                <p className="credits__source">
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer">Ver obra original en Sketchfab ↗</a>
                </p>
              )}
              <p className="credits__changes">
                <b>Cambios:</b> {item.modified || 'Adaptación para el probador virtual.'}
              </p>
              <p className="credits__file"><code>{item.file}</code></p>
            </article>
          ))}
        </div>

        <div className="credits__actions">
          <Link className="btn btn--primary" to="/scanner">Ir al probador</Link>
          <a className="btn btn--glass" href="/glasses/LICENSES.md">Ver licencias completas</a>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default Creditos3D;
