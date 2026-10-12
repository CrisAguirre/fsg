# Glassescanner - Contexto del Proyecto (MVP + fix prod + piloto batch)
> Actualizado 2026-10-12. Estado: MVP desplegado, fix crítico de `/analyze` en Render aplicado y verificado, piloto batch de 30 rostros ejecutado (100% detección, ver sección Hallazgos). Pendiente: `forma_real` + feedback ayuda + piloto real en óptica según `PILOTO_30.md`.

Este documento proporciona el contexto actual del proyecto para que otras inteligencias artificiales puedan continuar con el desarrollo.

## Información General
*   **Nombre del Proyecto:** Glassescanner (anteriormente conocido como FSG - Facial Scanner for Glasses).
*   **Propósito:** Aplicación web de escaneo facial y recomendación de monturas con veredicto Compatible/Parcial/Incompatible explicado + probador virtual.
*   **Stack Tecnológico:** Vite, React 19 + React Router, MediaPipe Tasks-Vision (FaceLandmarker 478 pts), Three.js (GLB opcional con fallback procedural). Backend hermano: `../Glassescanner-backend` (FastAPI + MediaPipe Python + MongoDB Motor).
*   **Despliegue:** Front `https://glassescanner.vercel.app/` (Vercel) · Back `https://glassescanner-backend.onrender.com` (Render, Docker `python:3.11-slim` + sysdeps `libgl1 libglib2.0-0 libsm6 libxext6 libxrender1` para OpenCV) · Mongo Atlas (`glassescanner`, 12 marcos seed).
*   **Estado Actual:** MVP funcional extremo a extremo: landing + `/scanner` + `/admin/frames` + `/piloto`. Back 9/9 tests PASS, front build OK. `/analyze` en prod estuvo caído (100% 400 `No se pudo decodificar`) y fue reparado el 2026-10-12 (ver Cambios Recientes 6-7). Piloto batch 30/30 ejecutado contra prod (ver Hallazgos). Desarrollo de features cerrado hasta piloto real en óptica.

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

## Estructura del Proyecto

```text
fsg/
├── vercel.json                    # rewrite SPA → /index.html (fix 404 /scanner)
├── .env / .env.example            # VITE_API_URL (Render en prod)
├── src/
│   ├── assets/logo/logo.png
│   ├── components/
│   │   ├── layout/ (Navbar con links Escáner/Catálogo/Piloto, Footer)
│   │   ├── ui/GlassCard.jsx
│   │   └── tryon/
│   │       ├── GlassesOverlay.js  # procedural 6 formas sobre landmarks
│   │       └── GlassesGLB.js      # GLB fotorrealista + fallback
│   ├── lib/api.js                 # health, analyze (timeout 12s), recommend, frames
│   ├── pages/
│   │   ├── Scanner.jsx/.css       # consentimiento Ley 1581, cámara/upload, veredicto, feedback ★, borrado
│   │   ├── AdminFrames.jsx/.css   # CRUD por optica_id con X-Admin-Key + stats feedback
│   │   └── Piloto.jsx             # registro guiado por caso (optica_id, caso_n)
│   ├── App.jsx / App.css / main.jsx (Router: / /scanner /admin/frames /piloto)
│   └── index.css
├── public/glasses/README.md       # cómo aporta sus GLB cada óptica
├── SCANNER_SPEC.md
└── agent.md (este archivo)

../Glassescanner-backend/
├── Dockerfile (python:3.11-slim + apt sysdeps libgl1/libglib2.0-0/libsm6/libxext6/libxrender1 — SIN esto `import cv2` falla en Render porque mediapipe arrastra opencv-contrib full)
├── requirements.txt (añadido `pillow==10.4.0` para decode sin cv2)
├── app/main.py (v0.2.0), config.py (CORS, ADMIN_KEY, Mongo), db.py (Motor), auth.py (X-Admin-Key)
├── app/routers/analyze.py (POST /analyze: decode PIL-primero sin cv2 + respaldo cv2.imdecode; el 400 incluye `[dbg len/ctype/head/pil/cv2/step]` TEMPORAL — quitar antes del cierre)
├── app/routers/frames.py (GET filtrado optica_id, CRUD protegido, POST /recommend, POST /frames/seed)
├── app/routers/feedback.py (POST /feedback, GET /feedback/stats con sugerencia)
├── app/expert/rules.py (matriz 7×6, pesos 40/30/20/10, umbrales 75/55; OJO: `temporal_est=138.0` hardcodeado, stub pendiente de derivar de landmarks)
├── app/expert/catalog.py + app/data/frames_seed.json (12 marcos)
├── app/face/geometry.py (MediaPipe FaceMesh en Render; Haar fallback local; OJO: posible sesgo a `diamante` en `classify_face`, ver Hallazgos)
└── tests/test_api.py (9 PASS)

../ (raíz Optic/)
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
*   `POST /analyze` (multipart photo JPG/PNG/WebP ≤5MB) → `FaceMetrics` o `face_detected:false`. El 400 de decode hoy expone `[dbg len/ctype/head/pil/cv2/step]` (diagnóstico temporal del fix 2026-10-12, pendiente revertir a mensaje simple).
*   `DELETE /analyze/photo` → confirmación borrado Ley 1581.
*   `GET /frames?optica_id` → catálogo (Mongo o fallback seed).
*   `POST /frames` / `PUT /frames/{id}` / `DELETE /frames/{id}` / `POST /frames/seed` → exigen `X-Admin-Key`.
*   `POST /recommend {metrics, frame_ids?, optica_id?}` → `[{frame_id, score, verdict, reasons[3]}]`.
*   `POST /feedback {face_shape, frame_id, verdict, helpful 1-5, optica_id?, caso_n?, comment?}` + `GET /feedback/stats`.

## Env vars (Render + Vercel, no commitear reales)
Front: `VITE_API_URL`. Back: `CORS_ORIGINS` (localhost + front prod), `MAX_PHOTO_MB=5`, `STORE_PHOTOS=false`, `ADMIN_KEY` (larga aleatoria), `MONGODB_URI`, `MONGODB_DB=glassescanner`.

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
    *   **Calibración facial morfométrica:** `classify_face` en `geometry.py` recalibrado con ratios antropométricos para discriminar las 7 formas (oblongo, redondo, cuadrado, triangular, corazón, diamante, oval), eliminando el falso sesgo hacia diamante.
    *   **Métricas faciales dinámicas:** Derivación de `temporal_est` real (mm), `ipd_mm_est` anatómico, `nose_bridge_mm_est`, `eyebrow_in_frame_zone` y ratios reales (`frente_pomulo`, `mandibula_frente`).
    *   **Scoring dinámico:** `rules.py` utiliza `temporal_est` medido y matriz de contraste ampliada para las 8 formas de monturas.
    *   **Higiene backend:** Revertido el mensaje de debug verbose del 400 en `analyze.py`, añadido `.gitignore` (.venv, __pycache__, .pytest_cache). 9/9 tests PASS en pytest.
7.  **Overhaul Frontend (Fases 4-5):**
    *   **API cliente completa:** `lib/api.js` con soporte para `listFrames(optica_id)`, `recommend(metrics, frame_ids, optica_id)`, helpers de feedback (`sendFeedback`, `getFeedbackStats`) y gestión de monturas (`createFrame`, `updateFrame`, `deleteFrame`, `seedFrames`).
    *   **Catálogo público para clientes:** Nueva página `/catalogo` (`Catalogo.jsx` + `Catalogo.css`) con filtros interactivos por forma, género, estilo, talla, rango de precio y tipo de lente, búsqueda reactiva, visualización de fichas técnicas y botón para probar en el escáner facial.
    *   **Navegación:** Enlaces de landing (`App.jsx`) y Navbar actualizados hacia `/scanner` y `/catalogo`.
    *   **Probador procedural 8 formas:** `GlassesOverlay.js` actualizado con renderizado procedural de `cat-eye` y `rimless`.
    *   **Escáner enriquecido:** `Scanner.jsx` renderiza desglose anatómico completo, badges y detalles de monturas en tarjetas de recomendación y soporte de preselección vía `?frameId=...`. Build de producción de Vite 100% OK.

## Deuda técnica resuelta
*   ✓ `temporal_est` dinámico derivado de landmarks en backend y frontend.
*   ✓ `[dbg...]` verbose revertido a mensaje limpio en 400 de `/analyze`.
*   ✓ `.gitignore` presente y activo en backend.
*   ✓ `api.js` completo con optica_id, feedback y CRUD.
*   ✓ Funnel de landing reparado hacia `/scanner` y `/catalogo`.
*   ✓ Soporte completo de 8 formas en probador procedural y 64 monturas en stock.

## Próximos Pasos (Hoja de Ruta)
1.  Llenar `forma_real,marco_lleva,va_bien` en `piloto-rostros/casos.csv` (ojo óptico) → correr lote con nueva calibración para calcular accuracy real.
2.  Recoger `helpful 1-5` por caso vía `/piloto` → `GET /feedback/stats` para afinar umbrales si se requiere.
3.  Piloto real en óptica según `PILOTO_30.md`.
4.  Carga de modelos GLB 3D fotorrealistas por montura en `public/glasses/` para ópticas asociadas.

