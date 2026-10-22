# Glassescanner - Contexto del Proyecto (MVP + fix prod + piloto batch)
> Actualizado 2026-10-20 (auditoría de geometría + scoring + feedback). Estado: MVP desplegado, backend 12/12 tests PASS, frontend build OK. Se corrigió un bug crítico de aspecto que sesgaba la forma facial y se recalibró el scoring (proporción 35 · contraste 25 · IPD 20 · puente 10 · cejas 10; umbrales 80/60). Pendiente: validación de `forma_real` por óptico con `piloto-rostros/anotador.html` + piloto real; rebranding a Grupo Prisma Visión al final (ver sección Rebranding).

Este documento proporciona el contexto actual del proyecto para que otras inteligencias artificiales puedan continuar con el desarrollo.

## Información General
*   **Nombre del Proyecto:** Glassescanner (anteriormente conocido como FSG - Facial Scanner for Glasses).
*   **Propósito:** Aplicación web de escaneo facial y recomendación de monturas con veredicto Compatible/Parcial/Incompatible explicado + probador virtual.
*   **Stack Tecnológico:** Vite, React 19 + React Router, MediaPipe Tasks-Vision (FaceLandmarker 478 pts), Three.js (GLB opcional con fallback procedural). Backend hermano: `../Glassescanner-backend` (FastAPI + MediaPipe Python + MongoDB Motor).
*   **Despliegue:** Front `https://glassescanner.vercel.app/` (Vercel) · Back `https://glassescanner-backend.onrender.com` (Render, Docker `python:3.11-slim` + sysdeps `libgl1 libglib2.0-0 libsm6 libxext6 libxrender1` para OpenCV) · Mongo Atlas (`glassescanner`, seed local de 64 marcos).
*   **Estado Actual:** MVP funcional extremo a extremo: landing + `/scanner` + `/catalogo` + `/admin/frames` + `/piloto`. Verificado 2026-10-20: backend **12/12 tests PASS**, frontend `npm run build` OK (Vite 8.3.2), catálogo seed de 64 marcos. `/analyze` en prod fue reparado el 2026-10-12. Se corrigió el sesgo de forma por aspecto de imagen y se recalibró el scoring; el clasificador de 7 formas sigue siendo provisional (ver Hallazgos). Desarrollo de features cerrado hasta piloto real en óptica; rebranding a Grupo Prisma Visión detectado pero **no aplicado** (ver sección Rebranding).

## Identidad Corporativa y Diseño (Design System)
El diseño se basa fuertemente en el estilo **Aeroglass / Glassmorphism** (efectos de cristal translúcido, desenfoques, bordes luminosos) y una temática "tech-futurista".

*   **Paleta de Colores (definida en `src/index.css`):**
    *   Fondo Principal (Deep Navy): `#070b18`
    *   Superficies: `#0d1225` / `#111a35`
    *   Acento Primario (Cyan Neon): `#00d4ff` (con variantes de glow y soft)
    *   Acento Secundario (Magenta): `#c839ff` (con variantes de glow y soft)
    *   Textos: `#e8ecf4` (principal), `#8892a8` (secundario), `#f0f4ff` (títulos)
*   **Tipografía:** `Outfit` (títulos/display), `Inter` (cuerpo de texto). Importadas en `index.html`.
*   **Glassmorphism:** Uso intensivo de fondos `rgba(255, 255, 255, 0.04)` combinados con `backdrop-filter: blur()`. Existen clases de utilidad `.glass` y `.glass--heavy` en `index.css`.
*   **Responsive:** CSS móvil ≤640px (targets 44px, video 300px, grid 1 col) en Scanner/Admin.

## Rebranding en curso — Grupo Prisma Visión (NO aplicado aún)
Detectado el 2026-10-20 en material **sin commitear** (`fsg/src/assets/data/`, fechado 2026-10-14):
*   **Marca objetivo:** GRUPO PRISMA VISIÓN.
*   **Identidad:** colores corporativos negro con blanco (contrasta con el deep navy/cyan/magenta actual).
*   **Dominio objetivo:** `grupoprismavision.vercel.app`.
*   **Evidencia:** `planeación.md` + 4 capturas de WhatsApp (referencias de marca/producto) en la misma carpeta.
*   **Estado del código:** sigue 100% con marca "Glassescanner" (`index.html`, landing, Navbar, logo, metadatos). No existe ninguna referencia a "Prisma" en `src/`.
*   **Decisión pendiente:** ¿rebranding total (empresa = producto) o Prisma Visión como empresa y Glassescanner como producto? Definir antes de tocar diseño, dominio y textos legales del piloto.

## Estructura del Proyecto

```text
fsg/
├── vercel.json                    # rewrite SPA → /index.html (fix 404 /scanner)
├── .env / .env.example            # VITE_API_URL (Render en prod)
├── src/
│   ├── assets/logo/logo.png
│   ├── assets/data/               # ⚠️ SIN COMMITEAR (2026-10-14): planeación.md + 4 refs WhatsApp — rebranding Prisma Visión
│   ├── components/
│   │   ├── layout/ (Navbar con links Escáner/Catálogo/Piloto, Footer)
│   │   ├── ui/GlassCard.jsx
│   │   └── tryon/
│   │       ├── GlassesOverlay.js  # procedural 8 formas sobre landmarks
│   │       └── GlassesGLB.js      # GLB fotorrealista + fallback
│   ├── lib/api.js                 # health, analyze (timeout 12s), recommend, frames, feedback, CRUD
│   ├── pages/
│   │   ├── Scanner.jsx/.css       # consentimiento Ley 1581, cámara/upload, veredicto, feedback ★, borrado
│   │   ├── Catalogo.jsx/.css      # catálogo público con filtros por forma/género/estilo/talla/precio/lente
│   │   ├── AdminFrames.jsx/.css   # CRUD por optica_id con X-Admin-Key + stats feedback
│   │   └── Piloto.jsx             # registro guiado por caso (optica_id, caso_n)
│   ├── App.jsx / App.css / main.jsx (Router: / /scanner /catalogo /admin/frames /piloto)
│   └── index.css
├── public/glasses/README.md       # cómo aporta sus GLB cada óptica
├── SCANNER_SPEC.md
└── agent.md (este archivo)

../Glassescanner-backend/
├── Dockerfile (python:3.11-slim + apt sysdeps libgl1/libglib2.0-0/libsm6/libxext6/libxrender1 — SIN esto `import cv2` falla en Render porque mediapipe arrastra opencv-contrib full)
├── requirements.txt (añadido `pillow==10.4.0` para decode sin cv2)
├── app/main.py (v0.2.0), config.py (CORS, ADMIN_KEY, Mongo), db.py (Motor), auth.py (X-Admin-Key)
├── app/routers/analyze.py (POST /analyze: decode PIL-primero sin cv2 + respaldo cv2.imdecode; 400 limpio "No se pudo decodificar la imagen")
├── app/routers/frames.py (GET filtrado optica_id, CRUD protegido, POST /recommend, POST /frames/seed)
├── app/routers/feedback.py (POST /feedback, GET /feedback/stats con sugerencia)
├── app/expert/rules.py (matriz 7 rostros × 8 formas, pesos 35/25/20/10/10, umbrales 80/60; `temporal_est` medido con fallback 138.0 si falta)
├── app/expert/catalog.py + app/data/frames_seed.json (64 marcos)
├── app/face/geometry.py (MediaPipe FaceMesh en Render; Haar fallback local; distancias en píxeles; `classify_face` provisional, corregible en `/scanner`)
└── tests/test_api.py (12 PASS)

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
Front: `VITE_API_URL`. Back: `CORS_ORIGINS` (localhost + front prod), `MAX_PHOTO_MB=5`, `STORE_PHOTOS=false`, `ADMIN_KEY` (larga aleatoria), `MONGODB_URI`, `MONGODB_DB=glassescanner`.

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

## Verificación técnica 2026-10-20
*   Backend: `python -m pytest -q` → **12 passed** (warning de deprecación Starlette/httpx, no bloqueante). Los tests locales usan fallback Haar; la geometría MediaPipe se validó aparte con la función real sobre los 30 casos.
*   Frontend: `npm run build` → OK en 1.09s; bundle principal 978.58 kB (Vite advierte >500 kB, candidato a code-splitting).
*   Catálogo: `frames_seed.json` → **64 marcos** cargados.
*   Git: último commit `fsg` `df9179a` y backend `17815cf`, ambos 2026-10-13; mensajes de commit no descriptivos ("465465", "5466446").
*   Sin commitear: `fsg/src/assets/data/` (planeación + 4 imágenes, 2026-10-14) y los cambios de la auditoría 2026-10-20 en backend (geometry/rules/feedback/frames/schemas/tests) y frontend (Scanner/Piloto/Admin/CSS/agent.md). No se hizo commit ni push.

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
    *   **Tests:** 12/12 PASS. Test de aspect invariance actualizado para aceptar la forma que produzca el ML (la invariancia a==b sigue intacta).

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
*   ✓ Clasificador ML de 7 formas integrado (RF+SVM, joblib) con fallback a reglas.
*   ✓ Anotador v2 con métricas, badges comparativos y accuracy en vivo.
*   ✓ Script de accuracy con comparación ML vs reglas vs ground truth.

## Próximos Pasos (Hoja de Ruta)
1.  **Definir alcance del rebranding** Grupo Prisma Visión (empresa vs. producto) y, si aplica, unificar nombre/colores/dominio en front, metadatos y consentimiento. *Pendiente por decisión del usuario.*
2.  **Validar `forma_real` con ojo óptico:** abrir `piloto-rostros/anotador.html`, confirmar/corregir los 30 casos y exportar `casos.csv`; luego re-entrenar el clasificador ML con `scripts/train_classifier.py` (sin `--proxy`) para usar ground truth real. `va_bien` no aplica a este lote de stock (sin gafas).
3.  **Scoring:** recalibrado 2026-10-20 (provisional). Revisar con `RECALIBRACION.md` cuando haya `n≥30` de feedback; no mover pesos con la muestra actual.
4.  **Feedback:** circuito listo (`/scanner` → `/piloto` → `/feedback/stats`), pendiente recolectar casos reales y revisar `fit_rate` / `shape_accuracy`.
5.  Piloto real en óptica según `PILOTO_30.md`.
6.  Carga de modelos GLB 3D fotorrealistas por montura en `public/glasses/` para ópticas asociadas.
7.  Higiene de repo: commitear `src/assets/data/` (o ignorarlo), usar mensajes de commit descriptivos y añadir code-splitting al bundle >500 kB.
8.  **Reentrenar clasificador ML:** cuando el óptico confirme las 30 formas y haya datos del piloto real (n≥60), re-entrenar con `train_classifier.py` sin `--proxy` para subir el LOO accuracy. Considerar features adicionales (eyebrow_in_frame_zone, temporal_est normalizado).

