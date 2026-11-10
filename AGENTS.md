# AGENTS.md — GPV / Glassescanner

> Este archivo define **cómo se trabaja** en el proyecto: límites, proceso de
> refactor, verificación y deuda conocida. El contexto funcional y la hoja de
> ruta viven en [`agent.md`](agent.md). La auditoría por fases está en
> [`../AUDITORIA.md`](../AUDITORIA.md).

## 1. Repositorios y límites

| Ruta | Rol | Stack |
|---|---|---|
| `.` (este repo) | Frontend / PWA | Vite 8, React 19, React Router, MediaPipe Tasks-Vision, Three.js |
| `../Glassescanner-backend/` | API | FastAPI, MediaPipe Python, scikit-learn (RF+SVM), MongoDB Motor |
| `../piloto-rostros/` | Ground truth y lotes | CSV, HTML anotador, JSON de métricas |
| `../scripts/` | Herramientas de datos | Python stdlib + joblib |

Reglas de frontera:

- El front no importa código del backend ni viceversa; solo comparten contratos HTTP.
- Los contratos de `POST /analyze`, `POST /recommend`, `GET /frames`,
  `POST /feedback` y CRUD de marcos están congelados. Cambiarlos exige versionar.
- Las fotos no se almacenan (`STORE_PHOTOS=false`). Cualquier cambio debe conservar
  consentimiento Ley 1581 y borrado (`DELETE /analyze/photo`).
- El registro del escaneo es local (pantalla + JSON descargable). No añadir
  endpoint ni persistencia de métricas sin consentimiento y contrato nuevo.

## 2. Proceso de refactorización

### 2.1 Principios

1. **Un cambio, una responsabilidad.** No mezclar refactor estructural con cambios
   de comportamiento o de copy.
2. **Extraer por capas, no por tamaño:**
   - lógica pura y testeable → `src/lib/`
   - estado/efectos de navegador (cámara, MediaPipe, WebGL, descargas) → `src/hooks/`
   - UI presentacional → `src/components/scanner/`
   - `Scanner.jsx` queda como orquestador (estado de flujo y composición).
3. **Sin duplicar constantes visuales.** Colores de armazón y familias de tinte
   viven en `src/components/tryon/frameStyle.js`.
4. **Carga diferida obligatoria** de todo lo pesado: `Three.js`/`Frame3D` se
   importa con `src/components/tryon/arLoader.js`; nunca estático desde `Scanner`.
5. **Los assets 3D no se tocan sin licencia.** Todo GLB nuevo exige entrada en
   `public/glasses/manifest.json`, atribución en `LICENSES.md` y página
   `/creditos-3d`.
6. **El flujo principal manda:** foto/cámara → análisis de simetría y rasgos →
   recomendación del motor experto → montura seleccionable en la misma vista del
   probador. Cualquier cambio de UI debe conservar ese recorrido sin pasos
   manuales extra.

### 2.2 Mapa de módulos del front

```text
src/
├── pages/Scanner.jsx              # asistente de 3 pasos + probador autónomo opcional (4.ª card)
├── hooks/
│   ├── useLiveCameraTryOn.js      # getUserMedia + MediaPipe VIDEO + try-on 3D/2D en vivo
│   ├── usePhotoTryOn.js           # MediaPipe IMAGE + GLB 3D + recorte 2D + descarga HD
│   └── useReportTryOn.js          # montajes del informe (carga/error, respuestas obsoletas)
├── lib/
│   ├── api.js                     # cliente HTTP (timeouts, reintentos GET, caché de catálogo)
│   ├── compatibility.js           # % por forma/material/color/lente + centrado + ajuste
│   ├── faceLabels.js              # formas y etiquetas faciales (fuente única)
│   ├── faceLandmarker.js          # landmarker IMAGE compartido (GPU → CPU)
│   ├── imageUtils.js              # brillo y normalización de fotos
│   ├── lensCompatibility.js       # reglas lente ↔ montura ↔ rostro
│   ├── mediapipeTelemetry.js      # corta la telemetría de MediaPipe (403)
│   ├── pwa.js                     # registro del service worker (solo producción)
│   └── tryOnSnapshot.js           # top-2 monturas + montajes JPEG del informe
├── components/scanner/
│   ├── FeedbackBox.jsx            # voto 1-5★
│   ├── FrameStrip.jsx             # tira de monturas recomendadas sobre la foto
│   ├── LenteDot.jsx               # muestra de tinte
│   ├── ScanCapture.jsx            # cámara/foto reutilizable en ambos escaneos
│   ├── ScanRecord.jsx             # registro visible + descarga JSON del escaneo
│   ├── ScanReport.jsx             # informe membreteado imprimible (PDF) + JSON
│   ├── ScannerMetrics.jsx         # panel morfométrico + corrección de forma
│   ├── StepCards.jsx              # las 4 cards del paso 2 (la 3.ª obligatoria; la 4.ª alterna)
│   ├── TryOnStudio.jsx            # probador autónomo: cámara en vivo 3D o foto 2D/3D
│   ├── TryOnDetail.jsx            # montura probada + lentes compatibles
│   └── RecommendationCard.jsx     # tarjeta de recomendación
└── components/tryon/
    ├── frameStyle.js              # color de armazón + familia de tinte (fuente única)
    ├── arLoader.js                # import() único de Frame3D/Three.js
    ├── Frame3D.js                 # GlassesAR: pose + armazón procedural/GLB
    ├── GlassesGLB.js              # carga, normalización y tintado de GLB
    ├── GlassesOverlay.js          # try-on vectorial 2D (fallback)
    └── PhotoTryOn.js              # recorte 2D fotorrealista (cat-eye usa respaldo vectorial)
```

### 2.3 Pasos para un refactor

1. Leer `agent.md` y este archivo.
2. Identificar el límite: ¿lógica pura, efecto de navegador o UI?
3. Extraer sin cambiar comportamiento; mantener exports/props estables.
4. Ejecutar el **gate de verificación** (sección 3).
5. Actualizar `agent.md` y este archivo si cambió estructura, estado o roadmap.
6. Dejar los cambios listos y reportar archivos; **el commit y el deploy los hace
   el usuario** (no commitear desde el agente).

### 2.4 Flujo funcional del escáner

1. **Inicio:** el usuario pulsa “Iniciar escaneo”.
2. **Consentimiento** Ley 1581 (obligatorio antes de procesar).
3. **Escaneo 1, sin monturas:** cámara en vivo (MediaPipe VIDEO) o foto subida.
4. `POST /analyze` → forma de cara, simetría, proporciones, IPD, ancho temporal y
   puente nasal; `POST /recommend` → monturas ordenadas por compatibilidad.
5. **Cuatro cards:** informe del rostro · monturas recomendadas (probador 3D) ·
   escaneo con montura (**obligatorio**, bloqueado hasta confirmar la prueba
   física) · probador virtual (**opcional**, servicio alterno que no requiere el
   escaneo: cámara en vivo con montura 3D o foto subida/capturada con modelo
   2D/3D escogible).
6. **Escaneo 2, con la montura puesta:** se analiza solo el ajuste de esa montura
   (no se compara con el escaneo 1).
7. **Informe membreteado** descargable (PDF por impresión del navegador + JSON) con
   la foto original, los montajes de las dos monturas mejor valoradas, tipo de
   rostro, composición y % por forma, material, color y tipo de lente.
8. Feedback del piloto. Ninguna foto se almacena; ambos escaneos son locales.

## 3. Gate de verificación

```powershell
# Frontend (raíz de este repo)
npm run lint          # 0 warnings
npm run lint:eslint   # accesibilidad + hooks (0)
npm run lint:css      # stylelint (0)
npm run typecheck     # tsc --checkJs (0)
npm test              # vitest (60)
npm run test:e2e      # playwright (10; `npx playwright install chromium` la primera vez)
npm run build         # 0 errores y ningún chunk > 500 kB
npm run test:pose     # 14/14 verificaciones numéricas
npm run validate:glb  # 8/8 formas con GLB y atribución
npm run validate:pwa  # manifest, iconos y service worker
npm run test:pwa      # build + SW registrado + shell offline (vite preview)

# Backend
cd ..\Glassescanner-backend
.\.venv\Scripts\python.exe -m pytest -q   # 38/38
```

Auditoría ampliada (Fase 4 cerrada; ejecutarla al tocar backend):

```powershell
# Frontend
npm audit --omit=dev

# Backend
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m mypy app
.\.venv\Scripts\python.exe -m bandit -r app -q
.\.venv\Scripts\python.exe -m pip_audit --local
.\.venv\Scripts\python.exe -m pytest --cov=app
```

Definición de terminado:

- [ ] `lint`, `lint:eslint`, `lint:css` y `typecheck` sin hallazgos.
- [ ] `npm test` en verde.
- [ ] `npm run test:e2e` en verde (flujo foto → análisis → montura).
- [ ] `build` sin warnings de tamaño (Three.js queda en chunks diferidos).
- [ ] `test:pose`, `validate:glb` y `validate:pwa` en verde.
- [ ] `npm run test:pwa` en verde si se tocó el service worker o el manifiesto.
- [ ] `pytest` en verde si se tocó backend (38/38, cobertura ≥90 %).
- [ ] Documentación actualizada.
- [ ] Sin fotos ni claves reales en el diff.

## 4. Estado verificado (2026-11-09)

- Frontend: build OK en ~0.7 s. `Scanner` = **87.9 kB** (antes 81.8 kB; el informe
  añade la galería y los montajes). `Three.js` se descarga solo al activar el 3D
  (chunks 45/246/352 kB).
- Lint: **0 warnings**; ESLint, Stylelint y `tsc --checkJs`: **0**.
- `test`: **59/59**; `test:e2e`: **10/10**.
- **Informe con registro visual (2026-11-09):** tras el primer escaneo, el informe
  muestra primero la foto original y después los montajes de las dos monturas con
  mejor score (`pickTopFrames` + `renderTryOnSnapshots`). Usa el recorte 2D
  fotorrealista con respaldo vectorial, un único landmarker IMAGE compartido
  (`lib/faceLandmarker.js`) y JPEG en memoria que **no** entran al JSON ni al
  servidor. Estados de carga, error y aviso de rostro no detectado incluidos.
- **Excepción cat-eye (2026-11-09):** el asset `public/tryon/cat-eye-frame.webp`
  proviene de una foto en 3/4 con la patilla extendida y queda alto/torcido al
  superponerlo. `PhotoTryOn.js` usa `VECTOR_ONLY_KEYS = new Set(["cat-eye"])` y
  cae al render vectorial de `GlassesOverlay.js`, que sí queda simétrico y
  centrado sobre los ojos. Aplica al informe y al probador; se retirará cuando
  exista un recorte frontal limpio.
- **Resiliencia HTTP (2026-11-09):** `lib/api.js` usa `AbortController` (GET 12 s,
  mutaciones 20 s, `/analyze` 45 s) y reintenta una sola vez los GET
  (`health`, `listFrames`, `getFeedbackStats`) ante red caída, timeout o 5xx.
  Las mutaciones no se reintentan. `health()` valida `r.ok` y `listFrames` guarda
  el último catálogo bueno en `localStorage` (`gpv.frames.v1`, por `optica_id`)
  como respaldo ante cold start de Render o caída puntual.
- **PWA (2026-11-09):** `public/manifest.webmanifest` (standalone, iconos
  192/512/maskable y atajos a `/scanner` y `/catalogo`), iconos en
  `public/icons/`, y `public/sw.js` con navegación red-primero + shell cacheado,
  `/assets/*` caché-primero e imágenes/GLB caché-primero con refresco en segundo
  plano. `lib/pwa.js` registra el SW solo en producción; en dev se desactiva para
  no interferir con HMR. La API y los CDN no se cachean en el SW. `vercel.json`
  sirve `/sw.js` con `max-age=0` y `Service-Worker-Allowed: /`.
  `npm run test:pwa` verifica registro + recarga offline con `vite preview`.
- El E2E del probador en vivo usa la cámara falsa de Chromium
  (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`);
  MediaPipe y WebGL siguen mockeados, así que la validación real en móvil
  (permisos HTTPS, seguimiento y escala del armazón) queda pendiente.
- Telemetría de MediaPipe bloqueada en cliente (`lib/mediapipeTelemetry.js`):
  el POST a `odml.pa.googleapis.com/v1/log` respondía 403 y ensuciaba la consola;
  ahora se corta con un `Response` 200 vacío sin abrir conexión (privacidad).
- `test:pose`: **14/14**.
- `validate:glb`: **8/8** modelos CC BY 4.0.
- **CSP enforcing (2026-11-06):** `vercel.json` ahora usa `Content-Security-Policy`
  (antes era `Content-Security-Policy-Report-Only`). Verificar en producción que no
  bloquea recursos legítimos tras el próximo deploy a Vercel.
- **Escaneo con montura corregido (2026-11-06):** el botón "Escanear con montura"
  (paso 3) no emitía ninguna petición de red porque:
  1. `StepCards` tenía `disabled={!fitReady}` y tras el paso 1 `fitFrameId` era
     `""`, dejando el botón deshabilitado.
  2. `onFitScan` solo navegaba a `captureFit` sin invocar backend.
  3. La cámara se detenía (`stopCamera()`) al navegar y no se reiniciaba.
  4. La foto del escaneo 1 se descartaba de memoria.
  Se resolvió con: `lastScanFileRef` para persistir la foto, `handleScanFit()`
  que invoca `POST /analyze` + `POST /recommend`, auto-inicio de cámara en
  `captureFit`, botón `⚡ Escanear con foto actual` y fallback de navegación
  directa en `StepCards`.
- Flujo principal (2026-11-06): asistente de **3 pasos**. Escaneo 1 sin monturas →
  cuatro cards (informe · monturas · escaneo con montura · probador virtual) →
  escaneo 2 obligatorio con la montura puesta. El informe del escaneo 2 mide **el
  ajuste de esa montura** (score, veredicto, centrado PD/IPD y motivos), no se
  compara con el escaneo 1.
- Probador virtual independiente (`TryOnStudio.jsx`): 4.ª card opcional y servicio
  alterno. Pestaña de **cámara en vivo** con armazón 3D siguiendo el rostro y
  pestaña de **foto subida o capturada** con selector explícito 2D/3D, cambio de
  montura, opacidad, comparar original, zoom, guardado HD y evidencia JSON. No
  requiere análisis facial ni recomendaciones; solo el catálogo (`GET /frames`).
  Si el consentimiento compartido aún no se aceptó, muestra su propio gate.
- Informe membreteado (`ScanReport.jsx`): logo y nombre, folio, fecha, tipo de
  rostro, composición, medidas y **% por forma, material, color y tipo de lente**.
  Descarga como PDF (impresión del navegador) y JSON. Se genera en el cliente.
- Compatibilidad agregada (`lib/compatibility.js`): media del score del motor por
  atributo del catálogo + probabilidad media por tipo de lente.
- Escala del 3D en vivo: sin análisis se usa IPD estándar de **63 mm** para que
  el armazón nazca a tamaño de cara; con análisis se recalcula con la IPD medida
  y el `ancho_total_mm` real.
- Registro del escaneo: forma detectada/confirmada, simetría, IPD, ancho temporal,
  puente nasal, proporciones, cejas, advertencias y top-1; se puede descargar en
  JSON. Es local: no se envía ni se guarda la foto.
- **Backend — Tie-breaker geométrico (2026-11-06):** `POST /recommend` ordenaba
  empates (scores 95-100) solo por ID alfabético → `F01` dominaba el top-1.
  Ahora usa desviación acumulada en mm (`|ancho-temporal| + |A+D-IPD| + |D-puente|`)
  como criterio secundario: la montura con mejor calce ergonómico sube al top-1
  sin alterar el esquema de la API.
- **Backend — MediaPipe dual (2026-11-06):** `geometry.py` intenta primero
  `mediapipe.tasks.python.vision.FaceLandmarker` si `app/models/face_landmarker.task`
  existe; si falla o no está, usa `mp.solutions.face_mesh.FaceMesh` (estable).
  No cambia dependencias: `protobuf 4.25.9` sigue como riesgo aceptado.
- Backend: **38/38 tests**, cobertura **91 %**; Ruff, mypy y bandit sin
  hallazgos. Único riesgo aceptado: `protobuf 4.25.9` (`pip-audit`).
- ML de forma facial: el reentrenamiento con ground truth real **no se desplegó**
  (LOO 13 %, baseline 33 %). El modelo proxy sigue como fallback provisional y la
  corrección manual en `/scanner` es el mecanismo principal.
- Ver `../piloto-rostros/VALIDACION_FORMA_2026-10-25.md`.

## 5. Deuda conocida / próximos pasos

1. Recolectar `n≥60` casos reales de óptica con `forma_real` validada.
2. Reevaluar features (contorno de mandíbula, ángulo gonial, profundidad 3D) antes
   de volver a entrenar. No presentar accuracy no validada en la UI.
3. Recalibrar scoring solo con `n≥30` feedback real (`../RECALIBRACION.md`).
4. Decidir alcance del rebranding Grupo Prisma Visión (empresa vs. producto).
5. Validar los 8 GLB en móvil real (iOS Safari / Android) antes del piloto.
6. Validar en hardware real la cámara en vivo: escala inicial del armazón,
   permisos HTTPS y seguimiento con MediaPipe/WebGL (el E2E los mockea).
7. Limpiar el historial de commits (los mensajes actuales no son descriptivos).
8. **Verificar CSP enforcing en producción:** tras deploy a Vercel, confirmar en
   DevTools → Console que `Content-Security-Policy` no bloquea recursos legítimos.
   Si rompe algo, revertir a `Content-Security-Policy-Report-Only` en `vercel.json`.
9. **Spike MediaPipe Tasks API:** descargar `face_landmarker.task` a
   `Glassescanner-backend/app/models/`, comparar métricas contra los 30 rostros
   ground-truth en `piloto-rostros/` antes de hacer bump de `protobuf` a `>=5.29`.

## 6. Riesgos que no se deben reintroducir

- Importar `three` o `Frame3D` estáticamente en `Scanner.jsx`: rompe el code-splitting.
- Duplicar `frameColorHex` o la clasificación de tintes en cada motor.
- Subir a producción un clasificador ML sin validación externa.
- Añadir un GLB sin licencia comercial y sin atribución.
- Guardar fotos o datos biométricos sin consentimiento explícito.
- Volver a `except: pass` en rutas con I/O: los fallos deben quedar en logs
  (`logger.warning(..., exc_info=True)` o `logger.exception`).
- Dimensionar el armazón solo con métricas: la cámara en vivo debe arrancar con
  IPD estándar (63 mm) para no dibujar una montura de ~1 IPD.
- Enviar o persistir el registro del escaneo en el servidor: el registro es local
  y descargable; la foto nunca se almacena.
- Permitir telemetría de MediaPipe (`odml.pa.googleapis.com`): se bloquea en el
  cliente con `lib/mediapipeTelemetry.js`; no añadir ese host al CSP.
- Duplicar `FORMAS`/`FORMA_LABEL`: viven en `lib/faceLabels.js`.
- Habilitar el escaneo con montura sin confirmar la prueba física: el paso 3 es
  obligatorio y debe seguir bloqueado hasta que el cliente se ponga la montura.
- Ordenar `POST /recommend` solo por `(-score, frame_id)`: los empates deben usar
  el tie-breaker geométrico (`dev_prop + dev_pd + dev_bridge`) para que el top-1
  refleje el mejor calce real.
- Descartar la foto del escaneo 1: `lastScanFileRef` la mantiene en memoria para
  re-análisis inmediato en el escaneo con montura; no borrarla antes de ese paso.
- Volver a usar el asset 2D de cat-eye para superposición frontal: `VECTOR_ONLY_KEYS`
  en `PhotoTryOn.js` lo desvía al render vectorial porque el recorte viene de una
  foto en 3/4 y queda alto/torcido. Solo retirar la excepción con un asset frontal
  limpio y verificado sobre un rostro real.
- Cachear la API o los CDN dentro del service worker: `public/sw.js` solo maneja
  recursos estáticos del mismo origen. El catálogo ya tiene caché en `localStorage`
  y los CDN cambian de versión; interceptarlos produce respuestas obsoletas.
- Registrar el SW en desarrollo: `lib/pwa.js` solo lo hace en producción para no
  romper el HMR de Vite.
