# Glassescanner - Contexto del Proyecto

Este documento proporciona el contexto actual del proyecto para que otras inteligencias artificiales puedan continuar con el desarrollo.

## Información General
*   **Nombre del Proyecto:** Glassescanner (anteriormente conocido como FSG - Facial Scanner for Glasses).
*   **Propósito:** Aplicación web para el escaneo facial 3D y recomendación de monturas de gafas con alta precisión (99.8%).
*   **Stack Tecnológico:** Vite, React 19 + React Router, MediaPipe Tasks-Vision (FaceLandmarker 478 pts), Three.js (GLB opcional). Backend hermano: `../Glassescanner-backend` (FastAPI + MediaPipe Python + Mongo).
*   **Estado Actual:** Landing + ruta `/scanner` funcional (cámara en vivo con overlay landmarks + probador procedural 6 formas + GLB fotorrealista si existe, subida JPG/PNG/WebP, veredicto Compatible/Parcial/Incompatible con 3 razones, borrado Ley 1581). Desplegado: front Vercel + back Render + Mongo.

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

## Estructura del Proyecto

```text
src/
├── assets/
│   └── logo/
│       ├── logo.png                   # Icono principal (rostro 3D con gafas)
│       └── Creating_facial...jpg      # Logotipo original (sin usar actualmente en el hero)
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx / .css          # Navegación superior (efecto glass, logo, anclas)
│   │   └── Footer.jsx / .css          # Pie de página (efecto glow, copyright de Glassescanner)
│   └── ui/
│       └── GlassCard.jsx / .css       # Tarjeta reutilizable con efecto glass (variantes: default, accent, glow)
├── App.jsx / App.css                  # Ensamblaje de la Landing Page (Hero, Funciones, Pasos, Precisión)
├── index.css                          # Sistema de diseño, CSS Custom Properties, reset global, utilidades
└── main.jsx                           # Punto de entrada de React
```

## Cambios Recientes
1.  **Maquetación Base:** landing completa (Navbar, Hero, Features, How it works, CTA, Footer).
2.  **Scanner híbrido:** ruta `/scanner` (cámara `getUserMedia` + subida), preview landmarks MediaPipe, `POST /analyze` → `POST /recommend`, probador procedural (`GlassesOverlay.js` 6 formas) + GLB (`GlassesGLB.js` con fallback), botón Borrar mi foto, CSS móvil 640px.
3.  **Rebranding a Glassescanner** + docs: `GLASSESCANNER_PLAN.md`, `INVESTIGACION_SISTEMA_EXPERTO.md`, `ENV_SETUP.md`, `PILOTO_30.md`, `SCANNER_SPEC.md`, `public/glasses/README.md`.
4.  **Fixes deploy:** SPA rewrite `vercel.json`, CORS prod, `motor 3.6.1 + pymongo 4.9.2`, `VITE_API_URL` a Render.
5.  **Admin + piloto:** `/admin/frames` con `X-Admin-Key` (sessionStorage), `/piloto` (registro por caso con `optica_id`), encuesta 1–5★ → `/feedback` + `/feedback/stats`, `RECALIBRACION.md`, probador GLB con fallback.

## Próximos Pasos (Sugerencias)
*   Añadir la lógica de enrutamiento (ej. React Router) si la aplicación crecerá a múltiples páginas.
*   Implementar la funcionalidad real de "Iniciar Escaneo" (acceso a cámara, integración con bibliotecas de malla facial/TensorFlow/etc.).
*   Mejorar la accesibilidad (a11y) y el SEO en general.
*   Añadir internacionalización (i18n) si se requiere.
