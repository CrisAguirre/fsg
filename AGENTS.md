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
   viven en `src/components/tryon/frameStyle.js`; la paleta, los presets y la
   mezcla del lente viven en `src/components/tryon/lensStyle.js`.
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
│   ├── useReportTryOn.js          # montajes del informe (carga/error, respuestas obsoletas)
│   └── useConnectionQuality.js    # red lenta + preferencia manual + data-connection
├── lib/
│   ├── api.js                     # cliente HTTP (timeouts, reintentos GET, caché de catálogo, wakeBackend)
│   ├── compatibility.js           # % por forma/material/color/lente + centrado + ajuste
│   ├── connection.js              # detección pura de red lenta/ahorro de datos + override manual
│   ├── faceLabels.js              # formas y etiquetas faciales (fuente única)
│   ├── faceLandmarker.js          # landmarker IMAGE compartido (GPU → CPU)
│   ├── frameRanking.js            # ranking + diversidad por forma del informe
│   ├── imageUtils.js              # brillo y normalización de fotos
│   ├── lensCompatibility.js       # reglas lente ↔ montura ↔ rostro
│   ├── lightweightPreference.js   # preferencia manual de modo ligero (localStorage + memoria)
│   ├── mediapipeConfig.js         # versión/WASM/modelo de MediaPipe (fuente única)
│   ├── mediapipeTelemetry.js      # corta la telemetría de MediaPipe (403)
│   ├── pwa.js                     # registro del service worker (solo producción)
│   └── tryOnSnapshot.js           # top-2 monturas + montajes JPEG del informe
├── components/layout/HomeBoot.jsx # overlay con logo + wakeBackend + precarga del escáner
├── components/ui/AppPreloader.jsx # preloader reutilizable con logo
├── components/ui/ErrorBoundary.jsx # red de seguridad con logo + recarga
├── components/ui/UpdatePrompt.jsx  # aviso de versión nueva del PWA (SW en espera)
├── components/scanner/
│   ├── FeedbackBox.jsx            # voto 1-5★
│   ├── FrameStrip.jsx             # tira de monturas recomendadas sobre la foto
│   ├── LenteDot.jsx               # muestra de tinte
│   ├── LensControls.jsx           # panel flotante: color, intensidad y opacidad del lente
│   ├── ScanCapture.jsx            # cámara/foto reutilizable en ambos escaneos
│   ├── ScanRecord.jsx             # registro visible + descarga JSON del escaneo
│   ├── ScanReport.jsx             # informe imprimible (PDF) + JSON + galería top-10
│   ├── ScannerMetrics.jsx         # panel morfométrico + corrección de forma
│   ├── StepCards.jsx              # las 4 cards del paso 2 (la 3.ª obligatoria; la 4.ª alterna)
│   ├── TryOnStudio.jsx            # probador autónomo: cámara en vivo 3D o foto 2D/3D
│   ├── TryOnDetail.jsx            # montura probada + lentes compatibles
│   └── RecommendationCard.jsx     # tarjeta de recomendación
└── components/tryon/
    ├── frameStyle.js              # color de armazón + familia de tinte (fuente única)
    ├── surfaceTextures.js         # micro-texturas PBR procedurales por acabado
    ├── studioEnvironment.js       # IBL PMREM + ACES + luces de estudio compartidas
    ├── lensStyle.js               # paleta, presets y mezcla color/intensidad/opacidad del lente
    ├── arLoader.js                # import() único de Frame3D/Three.js
    ├── Frame3D.js                 # GlassesAR: pose + armazón procedural/GLB
    ├── GlassesGLB.js              # carga, normalización y tintado de GLB
    ├── landmarks.js               # anclas oculares compartidas (iris 478 → esquinas)
    ├── GlassesOverlay.js          # try-on vectorial 2D (fallback)
    └── PhotoTryOn.js              # recorte 2D solo si es frontal (rectangular/rimless)
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
npm test              # vitest (118)
npm run test:e2e      # playwright (10; `npx playwright install chromium` la primera vez)
npm run build         # 0 errores y ningún chunk > 500 kB
npm run test:pose     # 14/14 verificaciones numéricas
npm run test:alignment # 19/19 anclas 2D/3D (iris + fallback)
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
- [ ] `test:pose`, `test:alignment`, `validate:glb` y `validate:pwa` en verde.
- [ ] `npm run test:pwa` en verde si se tocó el service worker o el manifiesto.
- [ ] `pytest` en verde si se tocó backend (38/38, cobertura ≥90 %).
- [ ] Documentación actualizada.
- [ ] Sin fotos ni claves reales en el diff.

## 4. Estado verificado (2026-11-25)

- **Calibración de colocación, escala y oclusión 3D/2D en foto y vivo (2026-11-25):**
  - `GlassesGLB.js`: UVs triplanares uniformes (`ensureBoxUVs`) para todos los
    GLB sin texturas horneadas (`cat-eye`, `rectangular`, `wayfarer`, `cuadrado`,
    `rimless` y `temples` de `aviador`); escalado por ancho del **frente óptico**
    (evita encogimiento de `oval`/`wayfarer`/`redondo` por patillas abiertas);
    pivote Z en el centro óptico de los cristales (`zAnchor`) y `clipBackZ`
    seguro por modelo detrás de cristales/bisagras (evita cortar `wayfarer`).
  - `Frame3D.js` + `useLiveCameraTryOn.js`: `estimatePose` calcula `ipd` en
    píxeles reales (`cw`, `ch`) sin deformación en fotos/videos verticales
    inclinados; `render()` compensa el acortamiento proyectivo `cos(yaw)` para
    mantener escala real al girar el rostro; oclusor craneal invisible (`depthWrite: true`,
    `colorWrite: false`) adaptado al ancho temporal (`234`/`454`) que oculta
    la patilla lejana en vivo sin cortar el aro frontal; `poseSmoothing: 0.55`
    sincronizado con `smoothLandmarks` y fallback `(2*A + D + 14)/ipd`.
  - `manifest.json`: offsets verticales anatómicos (`oval` `-0.04`, `aviador`
    `-0.06`, `redondo` `-0.02`, `rimless` `+0.02`).
  - `PhotoTryOn.js` + `usePhotoTryOn.js` + `GlassesOverlay.js` + `Scanner.css`:
    escalado 2D por `ancho_total_mm / ipd`, centrado vectorial por `(A+D)/2`
    rotado con el ángulo ocular y `display: block` en `.scanner__zoomwrap .scanner__preview`.

- **Realismo PBR de monturas y lentes — Plan A + reemplazos parciales GLB (2026-11-24):**
  el usuario confirmó `aviador.glb` (Khronos `SunglassesKhronos.glb`, CC-BY-4.0,
  commit `50d60c6`, junto con `ensureBoxUVs()` y preservación de
  `metalnessMap`/`roughnessMap` en `GlassesGLB.js`) y `oval.glb` (Innerscene
  `sunglasses-453a7394`, CC0-1.0, commit `30c18cd`, con soporte CC0 en
  `validate_glb_manifest.mjs`). Los 5 reemplazos GLB restantes quedan diferidos;
  sobre el código actual se aplicaron mejoras PBR pendientes de commit:
  - `studioEnvironment.js`: softbox cenital estrecha (5.8) + tira alta de bisel,
    laterales direccionales, acentos traseros en IBL, piso oscuro,
    `environmentIntensity` 0.95 y luces (`key` 1.45, `rim` 0.78).
  - `frameStyle.js`: menor roughness y mayor clearcoat/`envMapIntensity` por acabado.
  - `surfaceTextures.js`: carey procedural RGB con domain warping (ámbar/espresso),
    metal cepillado con `repeat: 2` y anisotropía 0.72, acetato más suave y
    `specularIntensity` 0.85 (0.35 mate).
  - `GlassesGLB.js` y `Frame3D.js`: lentes con reflejo AR (`iridescence` 0.3 /
    0.14 en sol, `ior` 1.54, `roughness` 0.025, `envMapIntensity` 1.85), mezcla
    hacia blanco en carey (0.68 horneado / 0.45 procedural) y realce IBL en
    bisagras/plaquetas (`envMapIntensity >= 1.3`).
  - `public/glasses/manifest.json`: `aviador` restringe `frameMaterials` a
    `["temples"]`; `rimless` añade `lensMaterials: ["03_-_Default"]`.

- **Cambios confirmados e informe entregado (2026-11-24):** el juego de cambios
  del 19/11 quedó confirmado por el usuario en el commit `a91cb80` (12 archivos;
  mensaje «4566», no descriptivo — ver deuda §5.7). Gate ejecutado completo:
  `lint`/`lint:eslint`/`lint:css`/`typecheck` sin hallazgos, `npm test` 118/118,
  `test:e2e` 10/10, `build` OK, `test:pose` 14/14, `test:alignment` 19/19,
  `validate:glb` 8/8 y `validate:pwa` OK; flujo real contra Render y
  `vite preview` verificados. El informe técnico se entregó como PDF A4 de
  15 páginas en `../Informe-Fixes-Glassescanner-2026-11-19.pdf` (fuera del repo,
  no versionado). Sigue pendiente la validación en hardware real de la cámara
  en vivo (§5.6). Sin cambios en contratos HTTP ni Ley 1581.
- **Escaneo sin monturas, conexión y realismo (2026-11-19):** la cámara del
  escaneo (`capture`/`captureFit`) ya no dibuja monturas: `tryState.on` solo es
  `true` en `catalog`/`tryon` y `useLiveCameraTryOn` deja únicamente los puntos
  faciales. `api.js` usa `https://glassescanner-backend.onrender.com` como
  fallback de producción (antes `http://localhost:8000`), reintenta `/analyze`
  una vez ante fallo de red y `Scanner.jsx` distingue timeout, 5xx y red, con
  botón **↻ Reintentar análisis** sobre la foto ya capturada. `ScanReport` es un
  diálogo con scroll propio (body bloqueado), toolbar sticky, cierre con Escape
  y **← Volver al resumen**; al cambiar de fase se vuelve arriba y las
  transiciones respetan `prefers-reduced-motion`. `surfaceTextures.js` genera
  grano de acetato, veta de carey, cepillado metálico y micro-grano mate
  (color/normal/roughness/clearcoat normal) y `Frame3D`/`GlassesGLB` los aplican
  sin pisar los mapas horneados de los GLB; el entorno de estudio usa softboxes
  PMREM y las lentes suben a ior 1.52/envMap 1.35. `HomeBoot` muestra el overlay
  en cada carga completa (mín. 0,9 s, máx. 12 s, contador y botón para saltar) y
  adelanta `GET /frames`. También se corrigió la revocación de object URLs en
  StrictMode, que dejaba la vista previa en negro en desarrollo.

- Frontend: build OK en ~1 s. `Scanner` = **101.4 kB**. `Three.js` se descarga
  solo al activar el 3D o al generar un montaje 3D del informe (chunks
  47/248/352 kB).
- Lint: **0 warnings**; ESLint, Stylelint y `tsc --checkJs`: **0**.
- `test`: **118/118**; `test:e2e`: **10/10**; `test:pwa`: **1/1**;
  `test:pose`: **14/14**; `test:alignment`: **19/19**.
- **MediaPipe alineado y robustez de arranque (2026-11-14):** `lib/mediapipeConfig.js`
  es la fuente única de `MEDIAPIPE_VERSION` (**1.0.1**, igual que el paquete),
  `MEDIAPIPE_WASM_URL` y `MEDIAPIPE_MODEL_URL`; `faceLandmarker.js` y
  `useLiveCameraTryOn.js` lo consumen y `mediapipeConfig.test.js` falla si la
  dependencia se actualiza sin tocar la constante. `Scanner.jsx` reintenta
  `listFrames()` cuando `wakeBackend()` resuelve, así el catálogo no queda vacío
  si Render arranca después del primer timeout. `Navbar` añade un toggle de
  datos **Auto → Ligero → Completo** (`lightweightPreference.js` +
  `useConnectionQuality`) para Safari/Firefox, que no exponen Network Information
  API; offline siempre gana. `ErrorBoundary.jsx` envuelve las rutas en
  `main.jsx` y muestra logo + recarga si falla un render (WebGL/MediaPipe/chunk).
- **GLB optimizados (2026-11-14):** `cuadrado` 2,43 → **0,50 MB** (se podaron
  10 juegos de UV sin texturas), `oval` 1,54 → **0,86 MB** (texturas planas y
  metalRough sólidas convertidas a factores) y `redondo` 1,06 → **0,49 MB**
  (dedup + texturas recompresas, conservando normal/roughness). Los tres usan
  `KHR_mesh_quantization` (soportado por `GLTFLoader`), sin Draco/meshopt, y se
  verificaron con `gltf-transform validate` + captura headless del preview:
  misma forma y materiales que antes. El resto de formas (<0,3 MB) no se tocaron.
- **Accesibilidad y actualización del PWA (2026-11-14):** `public/sw.js` ya no
  hace `skipWaiting()` al instalar; la versión nueva queda en espera y
  `components/ui/UpdatePrompt.jsx` avisa con "Actualizar / Ahora no".
  `lib/pwa.js` expone `isPwaUpdateReady()`, `onPwaUpdate()` y
  `applyPwaUpdate()` (postMessage `SKIP_WAITING` + recarga solo tras confirmar).
  En el probador, el canvas ampliable responde a Enter/Espacio con
  `role="button"` y `aria-label`, los videos tienen etiqueta, y `LensControls`
  cierra con Escape devolviendo el foco al botón, con `:focus-visible` en
  toggle, muestras y sliders. Verificado el ciclo completo con un deploy
  simulado: aviso visible, actualización y recarga sin prompt residual.
- **Materiales PBR y realismo (2026-11-14):** `frameStyle.js` expone
  `frameFinish()`/`frameMaterialProfile()` con metalness, roughness, clearcoat,
  envMapIntensity y tintStrength por acabado (metal, mixto, carey, cristal,
  mate, acetato). `GlassesGLB.applyFrameTint` tiñe todos los armazones con el
  color del catálogo usando `frameMaterials` del manifest, conserva
  normal/roughness maps y solo descarta el mapa base casi negro; acetato, carey
  y cristal pasan a `MeshPhysicalMaterial` con clearcoat, los metales quedan en
  `MeshStandardMaterial`. `studioEnvironment.js` centraliza `SRGBColorSpace`,
  ACES (exposición 0.95), PMREM de `RoomEnvironment`
  (`environmentIntensity` 0.65) y `addStudioLights()` (hemi 0.5, key neutra
  1.25, fill 0.32, rim 0.5), compartido por `Frame3D` y `renderGLB`. La familia
  de carey se oscureció (`#4a240a`/`#5c3112`/`#8a5518`) para que no se lea
  naranja. En 2D, `PhotoTryOn` conserva brillos con `luminosity` en
  acetato/carey, reconstruye el cuerpo metálico con `screen` + `multiply` y
  limita la veladura blanca con `source-atop` para no teñir el fondo. Sin
  cambios en contratos HTTP, Ley 1581 ni persistencia de fotos.
- **Preloaders, despertar de Render y modo ligero (2026-11-13):** `index.html`
  trae un preloader estático con el logo (CSS inline, sin scripts inline por
  CSP) que `main.jsx` retira tras el montaje; `components/ui/AppPreloader.jsx`
  cubre rutas (`Suspense`) y el overlay del home. `lib/api.js` expone
  `wakeBackend()` (una sola petición `GET /health` compartida, timeout 60 s,
  caché de éxito 5 min) y `HomeBoot.jsx` lo dispara al entrar al home con overlay
  saltable (mín. 0,9 s, máx. 12 s; contador visible y «Continuar sin esperar») +
  aviso flotante con reintento; `Scanner.jsx`
  también lo dispara al montar para enlaces directos. `lib/connection.js`
  + `useConnectionQuality.js` detectan save-data/2G/3G/downlink/RTT/offline y
  marcan `data-connection="light"`: se prioriza 2D, cámara a 640 px, fotos y
  JPEG reducidos, sin GLB en el informe ni precarga del escáner, y el CSS apaga
  orbes/desenfoques/animaciones. El 3D manual sigue disponible. Sin cambios en
  contratos HTTP, Ley 1581 ni persistencia de fotos.
- **Controles de lente (2026-11-13):** el montaje del paso 2 y el probador
  (cámara y foto) muestran `LensControls.jsx` sobre el preview con tres
  controles: color (paleta fija de 8 tonos + selector nativo), intensidad y
  opacidad tipo transitions. El tipo de lente fija un preset de
  `lensStyle.js`; después el usuario puede ajustar los tres valores. El cambio
  se aplica en caliente al GLB 3D (`Frame3D.setLensStyle`), al recorte 2D
  (silueta cacheada por asset+color) y al vectorial (`lensGradient`). En
  `rimless`, sin malla de cristal en el GLB, se prefiere 2D/vectorial. No hay
  persistencia ni cambios en los contratos HTTP.
- **Calibración fina del montaje 3D (2026-11-13):** el giro invertido venía de la
  matriz facial de MediaPipe, que llega en **orden fila** mientras
  `THREE.Matrix4.fromArray` lee **orden columna**; `poseFromMatrix` ahora
  transpone. El desplazamiento venía de centrar la caja completa del GLB
  (patillas y tornillos incluidos); `buildGlbGroup` centra por la caja de los
  cristales (`findLensMeshes` + `mainLensMeshes` + `boxOfMeshes`) y el manifest
  deja `y: 0` en las 8 formas. El informe y el probador de foto activan
  `ar.clipBack = true` (plano local `z = -0.15`) para recortar las patillas
  proyectadas sobre las mejillas; la cámara en vivo lo mantiene apagado. Medido
  sobre 8 rostros reales: centro de cristales a ±0,03 IPD de la línea de ojos y
  giro <1° salvo un rostro con yaw ~27° (~4°, esperado).
- **Montaje del informe corregido (2026-11-12):** la causa de la desviación no era
  el ancla sino los assets: solo `rectangular` y `rimless` son recortes frontales;
  `aviador`, `cuadrado`, `oval`, `redondo`, `wayfarer` y `cat-eye` salieron de
  fotos en 3/4 con patillas extendidas. `renderTryOnSnapshots` ahora usa el recorte
  2D solo si `hasFrontalPhotoAsset(frame)` es true; para el resto renderiza el GLB
  3D con la pose real de MediaPipe y, si WebGL/GLB fallan, cae al vectorial. El
  cat-eye ya no depende de la excepción vectorial.
- **Anclas oculares con iris (2026-11-11):** `components/tryon/landmarks.js` es la
  fuente única de `FACE_IDX` y `eyeAnchors`. `lc`/`rc` son los centroides de iris
  (468–477) cuando la malla trae 478 puntos y la IPD de iris supera el 2 % del
  ancho; si faltan, son placeholder o la malla es de 468, cae al punto medio de
  las esquinas oculares. `measureGlasses` y `estimatePose` consumen la misma
  ancla; el 3D corrige el roll con la relación de aspecto (`cw`/`ch`) para
  coincidir con el 2D. Los casos sintéticos están en `landmarks.test.js`,
  `measureGlasses.test.js` y `scripts/verify_alignment.mjs`.
- **Informe con registro visual (2026-11-09):** tras el primer escaneo, el informe
  muestra primero la foto original y después los montajes de las dos monturas con
  mejor score (`pickTopFrames` + `renderTryOnSnapshots`). Usa un único landmarker
  IMAGE compartido (`lib/faceLandmarker.js`) y JPEG en memoria que **no** entran al
  JSON ni al servidor. Estados de carga, error y aviso de rostro no detectado
  incluidos.
- **Variedad y galería del informe (2026-11-10):** `lib/frameRanking.js` ordena
  las recomendaciones y `pickTopFrames` prioriza una **forma distinta** para la
  segunda foto; si no hay otra forma, completa por score. La sección 3 del
  informe muestra las **10 primeras monturas** con foto de producto independiente
  (no montada sobre la foto del cliente). Las miniaturas viven en
  `public/frames/thumbs/` (~10 kB cada una; script `scripts/build_frame_thumbs.py`)
  y caen a `imagen_url` si faltan. Aplica solo a `mode="scan"`.
- **Recortes 2D frontales vs. fotos 3/4 (2026-11-12):** solo
  `public/tryon/rectangular-*` y `public/tryon/rimless-*` son recortes frontales.
  Los assets de `aviador`, `cuadrado`, `oval`, `redondo`, `wayfarer` y `cat-eye`
  salieron de fotos de producto en 3/4 con las patillas extendidas: al escalarlos
  sobre un rostro quedan torcidos, altos y con la patilla cruzando la sien.
  `PhotoTryOn.js` expone `hasFrontalPhotoAsset(frame)` y
  `renderTryOnSnapshots` usa esta prioridad: **recorte 2D solo si es frontal →
  GLB 3D con la pose real → vectorial de `GlassesOverlay.js` como último recurso**.
  Aplica al informe y al probador de foto. El cat-eye ya no tiene una excepción
  propia: sigue la misma regla que el resto de formas 3/4.
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
- `test:pose`: **14/14**; `test:alignment`: **19/19**.
- `validate:glb`: **8/8** modelos (CC-BY-4.0 y CC0-1.0).
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
  montura, **tres controles de lente** (color, intensidad y opacidad con preset
  por tipo), comparar original, zoom, guardado HD y evidencia JSON. No
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
5. Validar los 8 GLB optimizados (cuantización incluida) en móvil real
   (iOS Safari / Android) antes del piloto.
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
- Escribir la versión de MediaPipe a mano en cada hook: `lib/mediapipeConfig.js`
  es la fuente única y `mediapipeConfig.test.js` exige que coincida con el
  paquete instalado. Bundle JS y WASM de versiones distintas rompen el landmarker.
- Reemplazar un GLB sin revalidar: `gltf-transform validate`, `test:pose`,
  `test:alignment`, `validate:glb` y una captura del preview. No usar Draco ni
  meshopt sin registrar los decoders en `GLTFLoader`; la cuantización
  (`KHR_mesh_quantization`) sí es segura.
- Forzar "modo completo" sin conexión: `readConnectionInfo` deja que offline gane
  sobre la preferencia manual.
- Volver a poner `skipWaiting()` en el `install` del SW: la versión nueva debe
  esperar a que el usuario confirme en `UpdatePrompt`; activarla sola mezcla
  assets viejos y nuevos a mitad de sesión.
- Hacer clicable un canvas sin teclado: el preview ampliable usa `role="button"`,
  `tabIndex` y Enter/Espacio. Los controles del lente cierran con Escape y
  devuelven el foco al toggle.
- Duplicar `frameColorHex` o la clasificación de tintes en cada motor.
- Duplicar la paleta o los presets de lente en cada motor: `lensStyle.js` es la
  fuente única. El tipo de lente fija color/intensidad/opacidad y el usuario
  puede ajustarlos; no reconstruir el GLB por cada cambio, usar
  `Frame3D.setLensStyle` sobre los materiales ya cargados.
- Recalcular las anclas oculares por motor: `components/tryon/landmarks.js`
  (`eyeAnchors`) es la fuente única; el 2D y el 3D deben usar los mismos centros
  de iris y el mismo fallback a esquinas.
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
- Usar un recorte 2D en 3/4 para superponerlo sobre un rostro frontal: los assets
  de `aviador`, `cuadrado`, `oval`, `redondo`, `wayfarer` y `cat-eye` vienen de
  fotos de producto con patilla extendida y quedan torcidos. `hasFrontalPhotoAsset`
  en `PhotoTryOn.js` limita el 2D a `rectangular` y `rimless`; el resto va al GLB
  3D y, si falla, al vectorial. Solo ampliar esa lista con recortes frontales
  verificados sobre un rostro real.
- Pasar la matriz facial de MediaPipe a `Matrix4.fromArray` sin transponer:
  llega en orden fila y Three.js la lee en columna, así que yaw/pitch/roll salen
  invertidos y la montura gira al revés (hasta ~20°). `poseFromMatrix` transpone
  siempre; los tests de pose deben construir matrices row-major.
- Centrar el GLB por la caja completa (patillas, tornillos): desplaza el centro
  óptico hasta 0,48 IPD. Se centra por la caja de los cristales y se descartan
  los meshes pequeños con `mainLensMeshes`; si no hay cristales declarados, se
  conserva la caja completa como respaldo.
- Cachear la API o los CDN dentro del service worker: `public/sw.js` solo maneja
  recursos estáticos del mismo origen. El catálogo ya tiene caché en `localStorage`
  y los CDN cambian de versión; interceptarlos produce respuestas obsoletas.
- Registrar el SW en desarrollo: `lib/pwa.js` solo lo hace en producción para no
  romper el HMR de Vite.
- Bloquear el home esperando a Render: el overlay de `HomeBoot.jsx` se puede
  saltar y expira a los 12 s; el aviso flotante con reintento es la única señal
  que debe quedar si el backend sigue frío. No volver a mostrarlo una sola vez
  por sesión ni a recortarlo a 2,8 s: el cold start de Render puede tardar más.
- Encender el try-on en la cámara de `capture`/`captureFit`: el escaneo facial y
  el escaneo con montura física solo capturan la foto y dibujan puntos faciales.
  `tryState.on` debe seguir limitado a `catalog`/`tryon`.
- Volver a `http://localhost:8000` como fallback de producción en `api.js`: sin
  `VITE_API_URL`, el deploy mostraba el error rojo de conexión. El fallback es el
  backend real de Render.
- Revocar un object URL en el cleanup de un efecto que depende del preview:
  StrictMode simula el desmontaje y deja el `<img>` sin cargar (vista previa
  negra). Se revoca la URL anterior cuando llega una nueva, no en el cleanup.
- Pisar el mapa base de un GLB que ya trae textura: `applySurfaceDetail` solo
  rellena los mapas ausentes; `forceMap` se reserva para el armazón procedural.
- Añadir scripts inline al preloader estático de `index.html`: la CSP de
  `vercel.json` no los permite. El preloader usa solo CSS inline y el logo
  `/icons/icon-192.png`.
- Descargar GLB/Three.js o precargar `Scanner.jsx` en modo ligero: `lightweight`
  debe omitir el 3D del informe, reducir cámara/fotos/JPEG y desactivar la
  precarga; el 3D solo se carga si el usuario lo activa a mano.
- Ignorar `lightweight` en los hooks de cámara/foto: `useLiveCameraTryOn` pide
  640 px y `usePhotoTryOn` reduce canvas y calidad JPEG; mantener esos límites
  evita volver a penalizar a los dispositivos lentos.
- Duplicar luces, exposición o entorno entre `Frame3D` y `renderGLB`: la
  iluminación vive en `studioEnvironment.js` (`setupStudioEnvironment` +
  `addStudioLights`). Una key cálida o un `environmentIntensity` alto lavan el
  carey y lo vuelven anaranjado.
- Pintar brillos 2D con `fillRect` y `screen`/`multiply` sin `source-atop`: esos
  blends también pintan el fondo transparente y dejan un rectángulo visible.
  Cualquier veladura debe limitarse al alfa del armazón.
