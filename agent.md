# Grupo Prisma Visión — Glassescanner 3D · Contexto del Proyecto
> Actualizado 2026-10-25: Refactorización del escáner completada (de 1011 a 421 líneas, con hooks y componentes extraídos), code-splitting de Three.js (`Scanner` de 651 kB → **43.57 kB**) y unificación de la lógica 3D duplicada en `frameStyle.js`. Se añadieron los 8 GLB por forma con manifest y licencias CC BY 4.0 (`/creditos-3d`), el validador `npm run validate:glb` (8/8) y la verificación numérica `npm run test:pose` (9/9). Lint sin warnings, build OK y backend 15/15. El reentrenamiento ML del 25/10 **no se desplegó** (LOO 13 % vs baseline 33 %); el modelo proxy sigue como fallback y la corrección manual de forma es el mecanismo principal. Proceso de trabajo en [`../AGENTS.md`](../AGENTS.md).

Este documento proporciona el contexto actual del proyecto para que otras inteligencias artificiales puedan continuar con el desarrollo.

## Información General
*   **Organización / Marca:** Grupo Prisma Visión (GPV).
*   **Nombre del Producto:** Glassescanner 3D (Escáner Facial y Asesoría Biométrica para Monturas).
*   **Propósito:** Aplicación web de escaneo facial y recomendación de monturas con veredicto Compatible/Parcial/Incompatible explicado + probador virtual fotorrealista híbrido (2D foto / 3D procedural / 2D vectorial).
*   **Stack Tecnológico:** Vite, React 19 + React Router, MediaPipe Tasks-Vision (FaceLandmarker 478 pts), Three.js (GlassesAR 3D procedural y GLB por forma, cargado de forma diferida), Canvas 2D (PhotoTryOn con recortes transparentes y GlassesOverlay procedural), Context API para temas (`ThemeProvider` + `useTheme`). Backend hermano: `../Glassescanner-backend` (FastAPI + MediaPipe Python + Random Forest + SVM ML + MongoDB Motor).
*   **Despliegue:** Front `https://glassescanner.vercel.app/` (Vercel) · Back `https://glassescanner-backend.onrender.com` (Render, Docker `python:3.11-slim` + sysdeps para OpenCV) · Mongo Atlas (`glassescanner`, seed local de 64 marcos).
*   **Estado Actual:** MVP funcional extremo a extremo con imagen corporativa oficial: landing + `/scanner` + `/catalogo` + `/admin/frames` + `/piloto` + `/creditos-3d`. Verificado 2026-10-25: backend **15/15 tests PASS**, frontend `npm run lint` **0 warnings**, `npm run build` OK, `npm run test:pose` **9/9** y `npm run validate:glb` **8/8**.

## Identidad Corporativa y Diseño (Design System)
El diseño combina **Minimalismo Corporativo Prémium** con **Aeroglass / Glassmorphism** de alta gama óptica.

*   **Colores Corporativos Oficiales (definidos en `src/index.css`):**
    *   **Blanco:** `#ffffff`
    *   **Negro:** `#0a0b0e` / `#000000`
    *   **Gris Claro:** `#f8fafc`, `#f1f5f9`, `#e2e8f0`, `#cbd5e1`
    *   **Gris Oscuro:** `#121316`, `#181a20`, `#1e2128`, `#2b2f38`, `#374151`
*   **Soporte de Vista Diurna y Nocturna:**
    *   Gestionado por `ThemeContext.jsx` (`ThemeProvider`) y `useTheme.js` (`useTheme()`), con el contexto puro en `themeContextValue.js` para cumplir la regla de fast-refresh.
    *   Selector interactivo en `Navbar.jsx` con iconos Sol (☀️) / Luna (🌙) y feedback accesible.
    *   Persistencia en `localStorage` (`fsg_theme`) y sincronización con `meta[name="theme-color"]`.
    *   **Vista Nocturna (`data-theme="dark"`):** fondos negros/grises oscuros, texto blanco/gris claro, acentos plata, logo corporativo blanco `logowhite.png`.
    *   **Vista Diurna (`data-theme="light"`):** fondos blancos/grises muy claros, texto negro/carbón, acentos grafito, logo corporativo negro `logoblack.png`.
*   **Logotipos Oficiales:**
    *   `src/assets/logowhite.png`: Logotipo con gafas y texto "GRUPO PRISMA VISION" en blanco.
    *   `src/assets/logoblack.png`: Logotipo con gafas y texto "GRUPO PRISMA VISION" en negro sólido.
*   **Tipografía:** `Outfit` (títulos/display), `Inter` (cuerpo de texto).
*   **Glassmorphism:** Uso de variables `var(--bg-glass)`, `var(--border-glass)`, `var(--border-accent)`, `var(--shadow-sm/md/lg)` que conmutan automáticamente entre modos.

## Estructura del Proyecto

```text
fsg/
├── vercel.json                    # rewrite SPA → /index.html (fix 404 /scanner)
├── .env (local, ignorado por git) / .env.example  # VITE_API_URL (Render en prod)
├── vite.config.js                 # codeSplitting: Three.js en chunks diferidos (maxSize 420 kB)
├── src/
│   ├── assets/logo/logo.png, logowhite.png, logoblack.png
│   ├── assets/data/               # planeación.md + 4 refs WhatsApp — rebranding Prisma Visión
│   ├── components/
│   │   ├── layout/ (Navbar con links Escáner/Catálogo/Piloto/Admin + selector de tema, Footer)
│   │   ├── ui/GlassCard.jsx
│   │   ├── scanner/               # UI presentacional extraída del escáner
│   │   │   ├── FeedbackBox.jsx    # voto 1-5★
│   │   │   ├── LenteDot.jsx       # muestra de tinte
│   │   │   ├── ScannerMetrics.jsx # panel morfométrico + corrección de forma
│   │   │   ├── TryOnDetail.jsx    # montura probada + lentes compatibles
│   │   │   └── RecommendationCard.jsx
│   │   └── tryon/
│   │       ├── frameStyle.js      # color de armazón + familia de tinte (fuente única)
│   │       ├── arLoader.js        # import() diferido de Frame3D/Three.js
│   │       ├── PhotoTryOn.js      # try-on 2D fotorrealista (recortes webp) para modo foto
│   │       ├── Frame3D.js         # armazón 3D procedural Three.js (GlassesAR)
│   │       ├── GlassesOverlay.js  # probador 2D vectorial procedural 8 formas
│   │       └── GlassesGLB.js      # carga, normalización y tintado de GLB
│   ├── context/
│   │   ├── ThemeContext.jsx       # ThemeProvider
│   │   ├── themeContextValue.js   # createContext puro
│   │   └── useTheme.js            # hook de consumo
│   ├── hooks/
│   │   ├── useLiveCameraTryOn.js  # getUserMedia + MediaPipe VIDEO + try-on en vivo
│   │   └── usePhotoTryOn.js       # MediaPipe IMAGE + try-on foto + descarga HD
│   ├── lib/
│   │   ├── api.js                 # health, analyze (timeout 12s), recommend, frames, feedback, CRUD
│   │   ├── imageUtils.js          # brillo y normalización de fotos
│   │   └── lensCompatibility.js   # reglas lente ↔ montura ↔ rostro
│   ├── pages/
│   │   ├── Scanner.jsx/.css       # orquestador: consentimiento, flujo y composición (421 líneas)
│   │   ├── Catalogo.jsx/.css      # catálogo público con filtros por forma/género/estilo/talla/precio/lente
│   │   ├── AdminFrames.jsx/.css   # CRUD por optica_id con X-Admin-Key + stats feedback
│   │   ├── Creditos3D.jsx/.css    # atribuciones de los 8 GLB desde el manifest
│   │   └── Piloto.jsx             # registro guiado por caso (optica_id, caso_n)
│   ├── App.jsx / App.css / AppRoutes.jsx (carga diferida de rutas) / main.jsx
│   └── index.css
├── public/
│   ├── frames/                    # fotos base de catálogo (aviador.jpg, cat-eye.jpg, etc.)
│   ├── tryon/                     # recortes transparentes (*-frame.webp, *-lens.webp, manifest.json)
│   └── glasses/                   # 8 GLB por forma + manifest.json + LICENSES.md + README.md
├── scripts/
│   ├── build_tryon_assets.py      # pipeline rembg + OpenCV para extraer marcos y cristales simétricos
│   ├── verify_pose.mjs            # verificación numérica de pose/escala (npm run test:pose)
│   └── validate_glb_manifest.mjs  # GLB ↔ manifest ↔ licencias (npm run validate:glb)
├── SCANNER_SPEC.md
└── agent.md (este archivo)

../Glassescanner-backend/
├── Dockerfile (python:3.11-slim + apt sysdeps libgl1/libglib2.0-0/libsm6/libxext6/libxrender1 — SIN esto `import cv2` falla en Render porque mediapipe arrastra opencv-contrib full)
├── requirements.txt (añadido `pillow==10.4.0` para decode sin cv2)
├── app/main.py (v0.2.1, CORS restringido + rate limit básico), config.py (CORS, ADMIN_KEY, Mongo), db.py (Motor), auth.py (X-Admin-Key con compare_digest)
├── app/routers/analyze.py (POST /analyze: decode PIL-primero sin cv2 + respaldo cv2.imdecode; 400 limpio "No se pudo decodificar la imagen")
├── app/routers/frames.py (GET filtrado optica_id, CRUD protegido, POST /recommend, POST /frames/seed)
├── app/routers/feedback.py (POST /feedback, GET /feedback/stats con sugerencia)
├── app/expert/rules.py (matriz 7 rostros × 8 formas, pesos 35/25/20/10/10, umbrales 80/60; `temporal_est` medido con fallback 138.0 si falta)
├── app/expert/catalog.py + app/data/frames_seed.json (64 marcos)
├── app/face/geometry.py (MediaPipe FaceMesh en Render; Haar fallback local; distancias en píxeles; `classify_face` provisional, corregible en `/scanner`)
├── app/models/face_classifier.joblib (Random Forest + SVM; proxy actual, no validado con ground truth real)
└── tests/test_api.py (15 PASS)

../ (raíz GPV/)
├── GLASSESCANNER_PLAN.md          # planeación maestra + checklist S1–S6
├── INVESTIGACION_SISTEMA_EXPERTO.md
├── ENV_SETUP.md                   # vars: VITE_API_URL, CORS_ORIGINS, ADMIN_KEY, MONGODB_*
├── PILOTO_30.md + CONSENTIMIENTO_PILOTO.html (imprimible)
├── RECALIBRACION.md               # reglas con datos de /feedback/stats
├── piloto-rostros/
│   ├── casos/caso-01.jpg … caso-30.jpg (normalizados a JPG ≤1280px) + MAPEO.txt (origen avif/webp/jpg) + originales sin renombrar
│   ├── casos.csv                  # plantilla: `forma_real,marco_lleva,va_bien` VACÍOS — llenar con ojo óptico
│   ├── resultados.csv             # salida del batch 2026-10-12 (30/30 detectados, ver Hallazgos)
│   ├── resultados_pendiente.csv   # corrida inválida previa (errores 400 + fallback sin MediaPipe) — NO usar
│   └── README.md                  # protocolo de ubicación de fotos
└── scripts/piloto_batch.py        # lote: `POST /analyze` + `POST /recommend` por foto → `resultados.csv` (solo stdlib; `--api` default Render)
```

## Contratos API congelados
*   `GET /health` → `{status, version, db}`.
*   `POST /analyze` (multipart photo JPG/PNG/WebP ≤5MB) → `FaceMetrics` o `face_detected:false`. Error de decode devuelve 400 limpio (`No se pudo decodificar la imagen`).
*   `DELETE /analyze/photo` → confirmación borrado Ley 1581.
*   `GET /frames?optica_id` → catálogo (Mongo o fallback seed).
*   `POST /frames` / `PUT /frames/{id}` / `DELETE /frames/{id}` / `POST /frames/seed` → exigen `X-Admin-Key`.
*   `POST /recommend {metrics, frame_ids?, optica_id?}` → `[{frame_id, score, verdict, reasons[3]}]`.
*   `POST /feedback {face_shape, frame_id, verdict, helpful 1-5, optica_id?, caso_n?, comment?}` + `GET /feedback/stats`.

## Env vars (Render + Vercel, no commitear reales)
Front: `VITE_API_URL` (en `.env` local ignorado; configurar en Vercel). Back: `ENVIRONMENT` (`production` obliga a clave fuerte), `CORS_ORIGINS` (localhost + front prod), `CORS_ORIGIN_REGEX` (opcional para previews), `MAX_PHOTO_MB=5`, `RATE_LIMIT_PER_MINUTE=60`, `STORE_PHOTOS=false`, `ADMIN_KEY` (larga aleatoria; vacía deshabilita el CRUD), `MONGODB_URI`, `MONGODB_DB=glassescanner`.

## Hallazgos del Piloto Batch (2026-10-12; auditoría 2026-10-20)
`resultados.csv`: 30/30 rostros detectados.
*   **Formas detectadas (antes del fix):** cuadrado 17, oblongo 10, diamante 2, redondo 1. El sesgo dependía del aspecto de la foto, no del rostro.
*   **Causa raíz (2026-10-20):** `geometry.py` calculaba distancias sobre landmarks normalizados (`x/w`, `y/h`) sin pasar a píxeles. Fotos verticales → "cuadrado"; horizontales → "oblongo". Ej.: caso-01 858×1280 daba `largo_ancho=0.80`; corregido en píxeles da 1.19.
*   **Fix aplicado:** `metrics_from_landmarks()` convierte a píxeles antes de medir; test de regresión de aspecto en `tests/test_api.py`. Validado con MediaPipe sobre los 30 casos (`piloto-rostros/metrics_corregidas.json`).
*   **Clasificador de 7 formas:** tras corregir el aspecto, los ratios 2D siguen muy solapados (`largo_ancho` 1.09–1.37). Reglas originales, nuevas y arquetipos no reproducen las etiquetas visuales (mejor ~5/30). **Es provisional**: el `/scanner` permite corregir la forma manualmente y `/piloto` registra forma real vs. detectada.
*   **Veredictos (antes):** 30/30 `compatible` porque el scoring no medía IPD y el contraste pesaba 30. Recalibrado a proporción 35 · contraste 25 · IPD 20 · puente 10 · cejas 10, umbrales 80/60. Sobre 64×30: mediana 62.0; catálogo 546 compatible / 500 parcial / 874 incompatible; top-1 27 compatible / 3 parcial.
*   **Top-1 (después):** F08×7, F22×5, F03×3. Hay empates a 100 puntos (varias monturas igual de bien); el orden se desempata por `frame_id`. La concentración de top-1 no es accuracy; si se quiere diversidad, añadir desempate por estilo/medidas secundarias.
*   **Simetría:** mín 21.4 / media 79.7 / máx 98.3; el mínimo es un outlier a inspeccionar.
*   **Limitación de ground truth:** las 30 fotos son retratos de stock **sin gafas** → `marco_lleva=ninguno`, `va_bien=no_aplica`; solo se puede validar `forma_real`, no el ajuste real. `caso-02` es collage; `08/19/30` son 3/4 de perfil.
*   **Herramientas nuevas:** `piloto-rostros/anotador.html`, `casos_sugerido.csv`, `scripts/piloto_metrics.py`, `scripts/scoring_sim.py` y `INFORME_PILOTO.md`.

## Refactorización del escáner y modelo 3D (2026-10-25)

**Objetivo:** reducir el acoplamiento de `Scanner.jsx` y sacar Three.js del bundle inicial sin cambiar comportamiento.

### Estructura nueva

- `Scanner.jsx`: **1011 → 421 líneas**. Conserva consentimiento, estado del flujo, análisis y composición; ya no contiene cámara, MediaPipe ni descarga HD.
- `hooks/useLiveCameraTryOn.js`: `getUserMedia`, FaceLandmarker en modo VIDEO, suavizado de landmarks, try-on 3D/2D y limpieza de stream/WebGL.
- `hooks/usePhotoTryOn.js`: FaceLandmarker en modo IMAGE, prioridad recorte 2D → GLB → vectorial, métricas de ajuste y descarga HD a resolución natural.
- `components/scanner/`: `FeedbackBox`, `LenteDot`, `ScannerMetrics`, `TryOnDetail`, `RecommendationCard`.
- `lib/imageUtils.js`: brillo de referencia y normalización de fotos (≤1280 px, JPEG 0.88).
- `lib/lensCompatibility.js`: reglas lente ↔ montura ↔ rostro.
- `components/tryon/frameStyle.js`: **fuente única** de `frameColorHex`, `LENS_SWATCH`, `LENS_KIND` y `lensKind()`. `Frame3D`, `GlassesGLB`, `GlassesOverlay` y `PhotoTryOn` lo consumen; se eliminaron las copias.
- `components/tryon/arLoader.js`: un único `import()` de `Frame3D.js`; lo usan ambos hooks.
- `context/themeContextValue.js` + `useTheme.js`: separación para cumplir `react-refresh/only-export-components` (el nombre `themeContext.js` colisionaba con `ThemeContext.jsx` en Windows).

### Code-splitting (Vite 8 / Rolldown)

`vite.config.js` usa `build.rolldownOptions.output.codeSplitting` con un grupo `three` y `maxSize: 420 * 1024`:

| Chunk | Tamaño |
|---|---:|
| `Scanner-*.js` (antes 651 kB) | **43.57 kB** |
| `Frame3D-*.js` | 11.46 kB |
| `three-*.js` + fragmentos | 45.29 / 246.23 / 352.34 kB |
| `vision_bundle-*.js` | 153.20 kB |
| `GLTFLoader-*.js` | 45.20 kB |

Three.js solo se descarga cuando el usuario activa el probador 3D. Ya no hay warning de chunks > 500 kB.

### GLB y licencias

- 8 formas con GLB en `public/glasses/`: rectangular, cuadrado, redondo, oval, aviador, wayfarer, cat-eye, rimless.
- `manifest.json` define archivo, rotación, offset vertical, `scale` (zoom relativo), materiales de cristal/marco, autor, fuente y licencia.
- `LICENSES.md` atribuye las 8 obras (CC BY 4.0) y `/creditos-3d` las muestra desde el manifest.
- `npm run validate:glb` verifica archivo existente, campos obligatorios, licencia CC BY 4.0 y presencia en `LICENSES.md`.

### Decisión sobre el clasificador ML

`piloto-rostros/VALIDACION_FORMA_2026-10-25.md` documenta que el reentrenamiento con ground truth real obtuvo **LOO 13 %** frente a **baseline 33 %** y **proxy actual 47 %** (no validado). Por eso **no se desplegó**: se mantiene el proxy como fallback y la corrección manual de forma en `/scanner` sigue siendo el mecanismo principal. No presentar accuracy no validada en la UI.

## Verificación técnica 2026-10-25
*   Frontend `npm run lint` → **0 warnings** (se separó `useTheme`).
*   Frontend `npm run build` → OK; `Scanner` 43.57 kB y sin chunks > 500 kB.
*   `npm run test:pose` → **9/9** (pose frontal, signo de yaw, escala de lente F01, borde y cobertura pupilar).
*   `npm run validate:glb` → **8/8** formas con GLB y atribución CC BY 4.0.
*   Backend `python -m pytest -q` → **15 passed** (1 warning de deprecación de `httpx`/Starlette, ajeno al proyecto).
*   `git status`: cambios del refactor **sin commitear** al cierre de esta sesión.
*   Verificación previa 2026-10-24: build OK en 534 ms, 15/15 tests, 8 WebP de try-on y manifest con centros ópticos simétricos.

## Cambios Recientes (historial de la sesión)
1.  **Maquetación base + rebranding** a Glassescanner (landing, hero logo flotante).
2.  **Scanner híbrido** (`/scanner`): cámara + subida, landmarks en vivo, `/analyze`→`/recommend`, probador procedural + GLB, borrado Ley 1581, CSS móvil.
3.  **Fixes deploy:** `vercel.json` SPA, CORS prod, `motor 3.6.1 + pymongo 4.9.2` (fix `_QUERY_OPTIONS`), `VITE_API_URL` Render.
4.  **Admin + piloto:** `/admin/frames` con clave, `/piloto`, feedback ★, `RECALIBRACION.md`, consentimiento imprimible.
5.  **Cierre y normalización piloto (2026-10-12):** 30 fotos web normalizadas a `piloto-rostros/casos/caso-01.jpg…caso-30.jpg`. Fix crítico `/analyze` en Render (PIL-primero, Docker sysdeps).
6.  **Overhaul Backend (Fases 1-3):**
    *   **Modelo de Datos Ampliado:** `schemas.py` ampliado con `genero`, `precio_rango`, `marca`, `imagen_url`, `tipo_lente`, `estilo`, `talla` en `Frame`; y `temporal_est` en `FaceMetrics`.
    *   **Catálogo Profesional 64 marcos:** `frames_seed.json` generado con 64 monturas reales (8 por cada una de las 8 formas: rectangular, cuadrado, redondo, oval, aviador, wayfarer, cat-eye, rimless) con todas sus medidas ópticas (A, B, D, patilla, total), compatibilidad de lentes (monofocal, progresivo, blue-cut, etc.), marcas, estilos y rangos de precio.
    *   **Carga de catálogo:** `catalog.py` carga dinámicamente el seed completo de 64 monturas en memoria.
    *   **Calibración facial morfométrica (provisional):** `classify_face` en `geometry.py` usa ratios antropométricos para las 7 formas. La auditoría 2026-10-20 demostró que los ratios 2D no separan bien las 7 clases; se corrigió el sesgo por aspecto de imagen, se redujo el sesgo cuadrado/diamante y se añadió corrección manual de la forma en `/scanner`. No presentar como accuracy validada.
    *   **Métricas faciales dinámicas:** Derivación de `temporal_est` (mm), `ipd_mm_est` (proxy escalado por ancho temporal), `nose_bridge_mm_est`, `eyebrow_in_frame_zone` y ratios (`largo_ancho`, `frente_pomulo`, `mandibula_frente`) en píxeles.
    *   **Scoring dinámico:** `rules.py` usa `temporal_est` medido, IPD (PD≈A+D), puente, cejas y matriz de contraste de 3 niveles (25/12/0) para las 8 formas de monturas.
    *   **Higiene backend:** Revertido el mensaje de debug verbose del 400 en `analyze.py`, añadido `.gitignore` (.venv, __pycache__, .pytest_cache). 12/12 tests PASS en pytest.
7.  **Overhaul Frontend (Fases 4-5):**
    *   **API cliente completa:** `lib/api.js` con soporte para `listFrames(optica_id)`, `recommend(metrics, frame_ids, optica_id)`, helpers de feedback (`sendFeedback`, `getFeedbackStats`) y gestión de monturas (`createFrame`, `updateFrame`, `deleteFrame`, `seedFrames`).
    *   **Catálogo público para clientes:** Nueva página `/catalogo` (`Catalogo.jsx` + `Catalogo.css`) con filtros interactivos por forma, género, estilo, talla, rango de precio y tipo de lente, búsqueda reactiva, visualización de fichas técnicas y botón para probar en el escáner facial.
    *   **Navegación:** Enlaces de landing (`App.jsx`) y Navbar actualizados hacia `/scanner` y `/catalogo`.
    *   **Probador procedural 8 formas:** `GlassesOverlay.js` actualizado con renderizado procedural de `cat-eye` y `rimless`.
    *   **Escáner enriquecido:** `Scanner.jsx` renderiza desglose anatómico completo, badges y detalles de monturas en tarjetas de recomendación y soporte de preselección vía `?frameId=...`. Build de producción de Vite 100% OK.
8.  **Auditoría y actualización de contexto (2026-10-20):** verificación inicial 9/9 tests (luego 12/12) + build OK, recálculo de hallazgos del piloto (30/30 detectados, 30/30 `compatible`), corrección de datos obsoletos en este doc (12→64 marcos, debug 400 ya revertido) y detección de rebranding Grupo Prisma Visión sin aplicar.
9.  **Auditoría geometría + scoring + feedback (2026-10-20):** fix del sesgo por aspecto de imagen; scoring 35/25/20/10/10 con umbrales 80/60, IPD real (PD≈A+D) y topes por puente/pupila; `/recommend` ordenado; corrección manual de forma en `/scanner`; feedback ampliado (`face_shape_detected`, `recommended_frame_id`, `marco_lleva`, `va_bien`) y stats con `fit_rate`/`shape_accuracy`; anotador de ground truth y `INFORME_PILOTO.md`.
10. **Clasificador ML + anotador mejorado (2026-10-21):**
    *   **Clasificador ML (Random Forest + SVM ensemble):** `app/models/face_classifier.joblib` entrenado con 26 casos (proxy `casos_sugerido.csv`, excl. baja confianza). Features: `largo_ancho`, `frente_pomulo`, `mandibula_frente`, `symmetry_index`. Accuracy sobre datos de entrenamiento: **96% ML vs 19% reglas** (LOO cross-val: 23%, esperado con n=26). `geometry.py` carga el modelo al iniciar; `classify_face_ml()` es primario con fallback a `classify_face()` (reglas).
    *   **Anotador mejorado:** `piloto-rostros/anotador.html` v2 con panel de métricas por caso (L/A, F/P, M/F, simetría), badges comparativos (🤖 sistema vs 💡 sugerida IA), resumen de distribución, accuracy en vivo, migración automática de datos v1.
    *   **Script de accuracy actualizado:** `scripts/piloto_accuracy.py` ahora compara reglas vs ML vs ground truth con detalle por caso, distribuciones y criterios PILOTO_30.md.
    *   **Script de entrenamiento:** `scripts/train_classifier.py` con data augmentation (jitter ×8), LOO cross-validation, matriz de confusión y comparación reglas vs ML.
11. **Probador 2D Fotorrealista en Modo Foto (2026-10-24):**
    *   **Prioridad en foto:** 1. Recorte 2D real (`drawPhotoTryOn` en `PhotoTryOn.js`) → 2. Armazón 3D procedural (`GlassesAR` en `Frame3D.js`) si no hay asset o falla → 3. Dibujo vectorial 2D (`drawGlasses` en `GlassesOverlay.js`) como aproximación final. Implementado en render de canvas y descarga HD en `Scanner.jsx`.
    *   **Calibración de assets 2D:** los 8 formatos (`rectangular`, `rimless`, `aviador`, `cat-eye`, `cuadrado`, `oval`, `redondo`, `wayfarer`) recortados en WebP transparente con orificios limpios en ambos lentes y capa de cristal/reflejo (`public/tryon/*-frame.webp` y `*-lens.webp`).
    *   **Manifest calibrado:** `public/tryon/manifest.json` calibrado con centros ópticos simétricos nivelados horizontalmente al eje pupilar (`lc_x ≈ 0.251`, `rc_x ≈ 0.749`, `y0 == y1`, `ipdRatio ≈ 0.49-0.50`), corrigiendo el cálculo de escala y rotación.
    *   **Pipeline automatizado:** `scripts/build_tryon_assets.py` con garantía de simetría horizontal automática en agujeros de lente, reflejos y centros ópticos.
12. **Refactor del escáner + code-splitting (2026-10-25):**
    *   `Scanner.jsx` reducido de 1011 a 421 líneas; cámara/MediaPipe/try-on movidos a `hooks/useLiveCameraTryOn.js` y `hooks/usePhotoTryOn.js`; UI extraída a `components/scanner/`; utilidades puras a `lib/`.
    *   `Frame3D`/Three.js pasan a carga diferida mediante `components/tryon/arLoader.js`. `vite.config.js` separa el grupo `three` con `maxSize` de 420 kB.
    *   Resultado: `Scanner` 651 kB → **43.57 kB**, sin warning de chunks > 500 kB.
13. **Unificación 3D + validador de assets (2026-10-25):**
    *   `frameStyle.js` centraliza color de armazón, muestras y familias de tinte; se eliminaron las copias de `frameColorHex` y `lensTint` en `Frame3D`, `GlassesGLB`, `GlassesOverlay` y `PhotoTryOn`.
    *   `scripts/validate_glb_manifest.mjs` + `npm run validate:glb`: 8/8 GLB con manifest, autoría y licencia CC BY 4.0.
    *   `context/ThemeContext.jsx` dividido en `themeContextValue.js` + `useTheme.js` para dejar el lint en 0 warnings.
14. **Validación del clasificador ML (2026-10-25):**
    *   `piloto-rostros/VALIDACION_FORMA_2026-10-25.md`: 30/30 casos con `forma_real`; sistema guardado 33 %, reglas 27 %, proxy ML 47 %, baseline 33 %.
    *   El reentrenamiento con ground truth real obtuvo **LOO 13 %**, por debajo del baseline. **No se desplegó**; se conserva el proxy como fallback y la corrección manual de forma en `/scanner`.

## Deuda técnica resuelta
*   ✓ `temporal_est` dinámico derivado de landmarks en backend y frontend.
*   ✓ `[dbg...]` verbose revertido a mensaje limpio en 400 de `/analyze`.
*   ✓ `.gitignore` presente y activo en backend.
*   ✓ `api.js` completo con optica_id, feedback y CRUD.
*   ✓ Funnel de landing reparado hacia `/scanner` y `/catalogo`.
*   ✓ Soporte completo de 8 formas en probador procedural y 64 monturas en stock.
*   ✓ Fix del sesgo de forma por aspecto de imagen (distancias en píxeles + test de regresión).
*   ✓ Scoring con centrado óptico real (IPD) y contraste en 3 niveles; umbrales 80/60.
*   ✓ Feedback por caso con forma real vs. detectada, marco puesto y `va_bien`.
*   ✓ Clasificador ML de 7 formas integrado (RF+SVM, joblib) con fallback a reglas; el modelo actual es proxy y **no está validado** con ground truth real.
*   ✓ Anotador v2 con métricas, badges comparativos y accuracy en vivo.
*   ✓ Script de accuracy con comparación ML vs reglas vs ground truth.
*   ✓ Probador 2D fotorrealista con recortes transparentes, reflejos simétricos y cadena de fallback 2D cutout → 3D procedural → vectorial en `/scanner` y descarga HD.
*   ✓ `Scanner.jsx` desacoplado en hooks, componentes y utilidades (1011 → 421 líneas).
*   ✓ Three.js/`Frame3D` fuera del chunk inicial y descargado solo al activar el 3D.
*   ✓ `frameColorHex` y la clasificación de tintes unificados en `frameStyle.js`.
*   ✓ Manifest GLB validado automáticamente (`npm run validate:glb`, 8/8).
*   ✓ Lint sin warnings tras separar el contexto de tema y `useTheme`.

## Próximos Pasos (Hoja de Ruta)
1.  **Definir alcance del rebranding** Grupo Prisma Visión (empresa vs. producto) y, si aplica, unificar nombre/colores/dominio en front, metadatos y consentimiento. *Pendiente por decisión del usuario.*
2.  **Ampliar el ground truth:** los 30 casos ya tienen `forma_real`, pero el reentrenamiento con ellos dio LOO 13 %. Recolectar **n≥60** casos reales de óptica (incluyendo `corazon` y `triangular`) antes de volver a entrenar. `va_bien` no aplica al lote de stock sin gafas.
3.  **Scoring:** recalibrado 2026-10-20 (provisional). Revisar con `RECALIBRACION.md` cuando haya `n≥30` de feedback; no mover pesos con la muestra actual.
4.  **Feedback:** circuito listo (`/scanner` → `/piloto` → `/feedback/stats`), pendiente recolectar casos reales y revisar `fit_rate` / `shape_accuracy`.
5.  Piloto real en óptica según `PILOTO_30.md`.
6.  **Validar los 8 GLB en móvil real** (iOS Safari / Android) y ajustar `rot`/`y` del manifest con fotos de prueba; el validador actual solo comprueba archivo, metadatos y licencia.
7.  **Higiene de repo:** commitear o ignorar `src/assets/data/`, usar mensajes descriptivos y añadir CI que ejecute lint, build, `test:pose`, `validate:glb` y pytest. El code-splitting ya está resuelto.
8.  **Reentrenar clasificador ML:** solo tras el punto 2 y con features nuevas (contorno de mandíbula, ángulo gonial, profundidad 3D); no volver a usar el proxy ni presentar accuracy no validada. Mientras tanto, la corrección manual en `/scanner` es el mecanismo principal.

