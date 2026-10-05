# Glassescanner - Contexto del Proyecto

Este documento proporciona el contexto actual del proyecto para que otras inteligencias artificiales puedan continuar con el desarrollo.

## Información General
*   **Nombre del Proyecto:** Glassescanner (anteriormente conocido como FSG - Facial Scanner for Glasses).
*   **Propósito:** Aplicación web para el escaneo facial 3D y recomendación de monturas de gafas con alta precisión (99.8%).
*   **Stack Tecnológico:** Vite, React 19.
*   **Estado Actual:** Landing page inicial (maquetación) completada.

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
1.  **Maquetación Base:** Se construyó la landing page completa (Navbar, Hero, Features, How it works, CTA, Footer) utilizando CSS puro y variables.
2.  **Ajuste del Hero:** Se configuró para mostrar únicamente el icono (`logo.png`) flotante con efectos de aura (anillos y glow), removiendo el logotipo con texto original.
3.  **Rebranding a Glassescanner:** Se actualizó el nombre de "FSG" a "Glassescanner" en:
    *   El título del documento HTML (`<title>`).
    *   El texto del Navbar (junto al logo).
    *   El Footer (copyright y menciones).

## Próximos Pasos (Sugerencias)
*   Añadir la lógica de enrutamiento (ej. React Router) si la aplicación crecerá a múltiples páginas.
*   Implementar la funcionalidad real de "Iniciar Escaneo" (acceso a cámara, integración con bibliotecas de malla facial/TensorFlow/etc.).
*   Mejorar la accesibilidad (a11y) y el SEO en general.
*   Añadir internacionalización (i18n) si se requiere.
