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
5.  **Cierre:** lint limpio (un warning cosmético oxlint en Footer memoizado), sin TODOs en código.
6.  **Normalización piloto (2026-10-12):** 30 fotos web (8 avif + 4 webp + 18 jpg, nombres aleatorios) convertidas a `piloto-rostros/casos/caso-01.jpg…caso-30.jpg` (JPG RGB ≤1280px) + `MAPEO.txt` con la correspondencia. `casos.csv` ya apuntaba a esos nombres; `forma_real` sigue vacío.
7.  **Fix crítico `/analyze` en Render (2026-10-12):** prod devolvía 400 `No se pudo decodificar` en el 100% de fotos (incluso imagen en blanco; local 9/9 PASS). Diagnóstico vía error instrumentado: `import cv2` fallaba en el contenedor (`cv2=missing`, mediapipe arrastra opencv-contrib full que exige libGL ausente en `slim`). Commits backend: `92c2ace` (buffer escribible + fallback PIL), `e9599e9` (detalle dbg temporal), `fd40ffd` (decode PIL-primero sin cv2 + sysdeps en Dockerfile + `pillow==10.4.0`). Verificado en prod: 200 con `face_detected:true` (MediaPipe 478 pts, ej. simetría 97.7).
8.  **Piloto batch 30/30 contra prod (2026-10-12):** `python scripts/piloto_batch.py --api https://glassescanner-backend.onrender.com` → `piloto-rostros/resultados.csv`. Ver Hallazgos.

## Hallazgos del piloto batch (datos, no opiniones)
*   Detección 30/30 (100%, meta `PILOTO_30.md` ≥27/30 ✓). Infraestructura validada.
*   Formas detectadas: 24 `diamante` + 6 `oval`; 0 en las otras 5 clases → sospecha de sesgo en `classify_face` (`app/face/geometry.py:24-37`). Sin `forma_real` no hay accuracy medible.
*   Veredicto top1: 30/30 `compatible`, top1 siempre `F07` (Esencial Oval 139 mm) → scoring sin discriminación: `ancho_total 139 ≈ temporal_est stub 138` (`rules.py:21`) + contraste oval universal. `parcial_rate=0` → según `RECALIBRACION.md` NO tocar pesos/umbrales.
*   Simetría mediana 90.8, mínimos 21.4/23.8 (fotos no frontales: la muestra es web variada, NO protocolo `PILOTO_30.md`).
*   `avg_helpful` sin datos (el batch no recoge la pregunta 1–5) → pendiente vía `/piloto` + `POST /feedback`.

## Deuda técnica registrada (no reabrir sin motivo)
*   `temporal_est=138.0` hardcodeado (`rules.py:21`); `eyebrow_in_frame_zone=True` y ratios fijos en `analyze.py` — scoring simplificado hasta piloto real.
*   Revertir el `[dbg...]` verbose del 400 a mensaje simple antes del cierre.
*   Sin `.gitignore` en backend: se commitean `__pycache__/*.pyc` y `.pytest_cache` (commits `cc05c96`, `53ca223`, `acb83fd` solo contienen `.pyc`). Higiene de commits numéricos sin mensaje.
*   `lib/api.js`: `listFrames()` sin `optica_id`, `recommend()` sin `optica_id`; faltan helpers de feedback/CRUD (el contrato sí los soporta en back).
*   Landing `App.jsx`: botones apuntan a `#features`, no enlazan a `/scanner` (funnel roto).
*   `fsg/.env` con URL de prod commiteado (no es secreto, pero debería vivir solo en Vercel).

## Próximos Pasos (plan estipulado, en orden)
1.  Llenar `forma_real,marco_lleva,va_bien` en `piloto-rostros/casos.csv` (ojo óptico) → calcular accuracy real vs `forma_detectada` de `resultados.csv`.
2.  Recoger `helpful 1-5` por caso vía `/piloto` → `GET /feedback/stats`; aplicar `RECALIBRACION.md` (hoy: parcial 0% y sin ayuda ⇒ no tocar nada).
3.  Piloto real en óptica según `PILOTO_30.md` (luz frontal, consentimiento impreso, 5 min/caso, muestra 10+10+10).
4.  Solo con datos del piloto real: derivar `temporal_est` de landmarks, revisar sesgo `diamante`, revertir `[dbg...]`, añadir `.gitignore`.
5.  Conseguir GLB fotorrealistas por forma con la óptica (`public/glasses/README.md`).
6.  Auth real multi-óptica (hoy: `ADMIN_KEY` compartida, suficiente para piloto).
7.  Mejorar a11y/SEO e i18n si se requiere.
