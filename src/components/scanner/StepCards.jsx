// Tres cards animadas que aparecen tras el primer escaneo: informe, monturas
// recomendadas y escaneo con montura. La tercera es obligatoria y solo se
// habilita cuando el cliente ya se probó físicamente una montura.
export default function StepCards({
  recsCount,
  fitFrameName,
  onReport,
  onCatalog,
  onFitScan,
}) {
  const fitReady = !!fitFrameName;
  return (
    <section className="scanner__hub" aria-label="Resultado del escaneo facial">
      <div className="scanner__hub-grid">
        <article className="scanner__stepcard glass scanner__stepcard--1">
          <span className="scanner__stepcard-icon" aria-hidden="true">📄</span>
          <span className="scanner__stepcard-tag">Paso 1</span>
          <h3>Informe del rostro</h3>
          <p>
            Tipo de rostro, composición, medidas y % de compatibilidad con cada forma,
            material, color y tipo de lente.
          </p>
          <button type="button" className="btn btn--primary" onClick={onReport}>
            Ver informe
          </button>
        </article>

        <article className="scanner__stepcard glass scanner__stepcard--2">
          <span className="scanner__stepcard-icon" aria-hidden="true">👓</span>
          <span className="scanner__stepcard-tag">Paso 2</span>
          <h3>Monturas recomendadas</h3>
          <p>
            {recsCount > 0
              ? `${recsCount} monturas ordenadas por compatibilidad, con probador 3D sobre tu foto.`
              : "El catálogo está cargando. Vuelve a intentarlo en unos segundos."}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onCatalog}
            disabled={recsCount === 0}
          >
            Ver monturas
          </button>
        </article>

        <article
          className={`scanner__stepcard glass scanner__stepcard--3 ${fitReady ? "" : "scanner__stepcard--locked"}`}
        >
          <span className="scanner__stepcard-icon" aria-hidden="true">📸</span>
          <span className="scanner__stepcard-tag">Paso 3 · obligatorio</span>
          <h3>Escáner facial con montura</h3>
          <p>
            {fitReady
              ? `Ponte "${fitFrameName}" y escanea tu rostro para medir cómo te queda.`
              : "Primero elige una montura y pruébatela físicamente en el paso 2."}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onFitScan}
            disabled={!fitReady}
            title={fitReady ? undefined : "Disponible cuando confirmes que te probaste una montura"}
          >
            Escanear con montura
          </button>
        </article>
      </div>
    </section>
  );
}
