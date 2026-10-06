# Front `fsg/` — Spec Scanner (sin cabos sueltos)
Instalar: `npm i react-router-dom @mediapipe/tasks-vision three`
Env: `VITE_API_URL=http://localhost:8000` (prod: URL Render del backend).

## Vista Scanner `/scanner`
1. **Consentimiento Ley 1581:** checkbox + texto tratamiento biométrico + botón Borrar mi foto.
2. **Captura (tabs):**
   - Cámara: `getUserMedia` + LIVE_STREAM preview landmarks + Capturar → JPEG 0.85.
   - Subir: input JPG/PNG/WebP ≤5MB (alternativa pedida si no hay foto reciente).
   - Validar: 1 rostro, frontal ±15°, ojos abiertos, sin gafas oscuras; si falla, mensaje accionable.
3. **Análisis:** POST `/analyze` (timeout 12s, 1 reintento) + overlay 2D canvas inmediato aunque el back duerma.
4. **Veredicto:** score + Compatible/Parcial/Incompatible + 3 razones + lista `GET /frames` + try-on Three.js (GLB en `public/glasses/*.glb`, escala por IPD, anclaje landmark 168). Fallback SVG si no hay GLB.

## No olvidar
- HTTPS obligatorio para cámara (localhost ok, Vercel ok).
- iOS: la cámara exige gesto de usuario; mantener botón Capturar visible.
- `STORE_PHOTOS=false` por defecto; sólo métricas si hay opt-in.
- Health-check cruzado: el front muestra estado del back (`GET /health`).
