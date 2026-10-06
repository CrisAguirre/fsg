# Modelos 3D por forma (`public/glasses/`)
El probador usa el procedural (sin descargas) salvo que exista aquí
`<forma>.glb` (ej. `rectangular.glb`, `redondo.glb`, `aviador.glb`).

## Cómo agrega sus modelos cada óptica
1. Exporte cada montura en GLB (Blender: File → Export → glTF, +Y up, 1 unidad = 1 m aprox).
2. Centre el modelo en el puente nasal (origen) y con la medida real de sien a sien ≈ 1 unidad.
3. Copie el archivo como `<forma>.glb` o `<frame_id>.glb` y redespliegue el front.
4. El `GlassesGLB.js` lo detecta por HEAD y lo renderiza escalado por IPD; si no existe, sigue el procedural sin romperse.

Formas válidas: rectangular, cuadrado, redondo, oval, aviador, wayfarer (+ cat-eye, rimless).
