# Modelos 3D por forma (`public/glasses/`)

El probador en vivo usa los GLB fotorrealistas de esta carpeta. Si un GLB no
está en el manifest, falla la descarga o el dispositivo no soporta WebGL, el
probador conserva el armazón procedural como respaldo; en modo foto se mantiene
la prioridad del recorte 2D de `public/tryon/`.

## Archivos actuales

| Forma | Archivo | Peso |
|---|---|---:|
| rectangular | `rectangular.glb` | 0.26 MB |
| cuadrado | `cuadrado.glb` | 2.43 MB |
| redondo | `redondo.glb` | 1.06 MB |
| oval | `oval.glb` | 1.54 MB |
| aviador | `aviador.glb` | 0.26 MB |
| wayfarer | `wayfarer.glb` | 0.19 MB |
| cat-eye | `cat-eye.glb` | 0.12 MB |
| rimless | `rimless.glb` | 0.19 MB |

`manifest.json` es la fuente de verdad. Campos principales:

- `file`: nombre del GLB dentro de esta carpeta.
- `rot`: rotación en grados `[x, y, z]` para orientar el modelo hacia la cámara.
- `y`: desplazamiento vertical en unidades de IPD.
- `scale` (opcional): multiplicador de tamaño relativo al ancho calculado con las
  medidas de la montura. `1` = sin cambio; `0.95` reduce un 5 % y `1.05` amplía
  un 5 %.
- `targetWidth` (opcional): ancho absoluto en unidades de IPD. Tiene prioridad
  sobre el cálculo por medidas; `scale` se aplica después.
- `lensMaterials` / `lensOpacity`: materiales que se tratan como cristales y su
  transparencia base.
- `frameMaterials` / `frameColor`: materiales del marco que se recolorean.
- `source`, `title`, `author`, `author_url`, `source_url`, `license` y
  `modified`: atribución y trazabilidad de la obra.

El código `src/components/tryon/GlassesGLB.js` carga el manifest, cachea cada
GLB y normaliza el modelo en runtime (centrado, escala por ancho real de la
montura/IPD y tintado). `GlassesAR` aplica después la pose de la cabeza.

## Licencias y créditos

Los ocho modelos son **CC BY 4.0**. No se usan modelos con licencias NC, ND o
SA. Las atribuciones completas, autores y cambios están en
[`LICENSES.md`](./LICENSES.md), y también se muestran al usuario en
`/creditos-3d`.

**No agregue un GLB sin verificar su licencia y sin actualizar
`manifest.json`, `LICENSES.md` y la página de créditos.** Si la licencia no
permite uso comercial o exige compartir igual, no debe publicarse aquí.

## Cómo agregar una montura

1. Exporte la montura a GLB (Blender: File → Export → glTF; +Y arriba).
2. Verifique que la licencia permita uso comercial y atribución.
3. Copie el archivo como `<forma>.glb` o `<frame_id>.glb`.
4. Agregue la entrada en `manifest.json` con rotación, cristales y atribución.
5. Sume la atribución a `LICENSES.md` y a la página `/creditos-3d`.
6. Ejecute `npm run build` y pruebe el probador en vivo y en foto.

Formas válidas: rectangular, cuadrado, redondo, oval, aviador, wayfarer,
cat-eye y rimless.
