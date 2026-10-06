# Glassescanner - Contexto del Proyecto (cierre MVP)
> Actualizado al cierre del desarrollo. Estado: MVP completo y desplegado, pendiente piloto de 30 rostros en campo.

Este documento proporciona el contexto actual del proyecto para que otras inteligencias artificiales puedan continuar con el desarrollo.

## Información General
*   **Nombre del Proyecto:** Glassescanner (anteriormente conocido como FSG - Facial Scanner for Glasses).
*   **Propósito:** Aplicación web de escaneo facial y recomendación de monturas con veredicto Compatible/Parcial/Incompatible explicado + probador virtual.
*   **Stack Tecnológico:** Vite, React 19 + React Router, MediaPipe Tasks-Vision (FaceLandmarker 478 pts), Three.js (GLB opcional con fallback procedural). Backend hermano: `../Glassescanner-backend` (FastAPI + MediaPipe Python + MongoDB Motor).
*   **Despliegue:** Front `https://glassescanner.vercel.app/` (Vercel) · Back `https://glassescanner-backend.onrender.com` (Render) · Mongo Atlas (`glassescanner`, 12 marcos seed).
*   **Estado Actual:** MVP funcional extremo a extremo: landing + `/scanner` + `/admin/frames` + `/piloto`. Back 9/9 tests PASS, front build OK. Desarrollo cerrado hasta resultados del piloto.

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
├── app/main.py (v0.2.0), config.py (CORS, ADMIN_KEY, Mongo), db.py (Motor), auth.py (X-Admin-Key)
├── app/routers/analyze.py (POST /analyze real + DELETE /analyze/photo)
├── app/routers/frames.py (GET filtrado optica_id, CRUD protegido, POST /recommend, POST /frames/seed)
├── app/routers/feedback.py (POST /feedback, GET /feedback/stats con sugerencia)
├── app/expert/rules.py (matriz 7×6, pesos 40/30/20/10, umbrales 75/55)
├── app/expert/catalog.py + app/data/frames_seed.json (12 marcos)
├── app/face/geometry.py (MediaPipe en Render, Haar fallback local)
└── tests/test_api.py (9 PASS)

../ (raíz Optic/)
├── GLASSESCANNER_PLAN.md          # planeación maestra + checklist S1–S6
├── INVESTIGACION_SISTEMA_EXPERTO.md
├── ENV_SETUP.md                   # vars: VITE_API_URL, CORS_ORIGINS, ADMIN_KEY, MONGODB_*
├── PILOTO_30.md + CONSENTIMIENTO_PILOTO.html (imprimible)
└── RECALIBRACION.md               # reglas con datos de /feedback/stats
```

## Contratos API congelados
*   `GET /health` → `{status, version, db}`.
*   `POST /analyze` (multipart photo JPG/PNG/WebP ≤5MB) → `FaceMetrics` o `face_detected:false`.
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

## Próximos Pasos (post-piloto, NO tocar hasta tener datos)
*   Ejecutar piloto 30 rostros (`PILOTO_30.md`) y recalibrar según `RECALIBRACION.md` (parcial >40% o ayuda <4/5).
*   Conseguir GLB fotorrealistas por forma con la óptica (`public/glasses/README.md`).
*   Auth real multi-óptica (hoy: `ADMIN_KEY` compartida, suficiente para piloto).
*   Mejorar a11y/SEO e i18n si se requiere.
