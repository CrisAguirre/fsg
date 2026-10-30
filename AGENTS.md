# AGENTS.md — GPV / Glassescanner

> Este archivo define **cómo se trabaja** en el proyecto: límites, proceso de
> refactor, verificación y deuda conocida. El contexto funcional y la hoja de
> ruta viven en [`agent.md`](agent.md). La auditoría por fases está en
> [`../AUDITORIA.md`](../AUDITORIA.md).

## 1. Repositorios y límites

| Ruta | Rol | Stack |
|---|---|---|
| `.` (este repo) | Frontend / PWA | Vite 8, React 19, React Router, MediaPipe Tasks-Vision, Three.js |
| `../Glassescanner-backend/` | API | FastAPI, MediaPipe Python, scikit-learn (RF+SVM), MongoDB Motor |
| `../piloto-rostros/` | Ground truth y lotes | CSV, HTML anotador, JSON de métricas |
| `../scripts/` | Herramientas de datos | Python stdlib + joblib |

Reglas de frontera:

- El front no importa código del backend ni viceversa; solo comparten contratos HTTP.
- Los contratos de `POST /analyze`, `POST /recommend`, `GET /frames`,
  `POST /feedback` y CRUD de marcos están congelados. Cambiarlos exige versionar.
- Las fotos no se almacenan (`STORE_PHOTOS=false`). Cualquier cambio debe conservar
  consentimiento Ley 1581 y borrado (`DELETE /analyze/photo`).
- El registro del escaneo es local (pantalla + JSON descargable). No añadir
  endpoint ni persistencia de métricas sin consentimiento y contrato nuevo.

## 2. Proceso de refactorización

### 2.1 Principios

1. **Un cambio, una responsabilidad.** No mezclar refactor estructural con cambios
   de comportamiento o de copy.
2. **Extraer por capas, no por tamaño:**
   - lógica pura y testeable → `src/lib/`
   - estado/efectos de navegador (cámara, MediaPipe, WebGL, descargas) → `src/hooks/`
   - UI presentacional → `src/components/scanner/`
   - `Scanner.jsx` queda como orquestador (estado de flujo y composición).
3. **Sin duplicar constantes visuales.** Colores de armazón y familias de tinte
   viven en `src/components/tryon/frameStyle.js`.
4. **Carga diferida obligatoria** de todo lo pesado: `Three.js`/`Frame3D` se
   importa con `src/components/tryon/arLoader.js`; nunca estático desde `Scanner`.
5. **Los assets 3D no se tocan sin licencia.** Todo GLB nuevo exige entrada en
   `public/glasses/manifest.json`, atribución en `LICENSES.md` y página
   `/creditos-3d`.
6. **El flujo principal manda:** foto/cámara → análisis de simetría y rasgos →
   recomendación del motor experto → montura seleccionable en la misma vista del
   probador. Cualquier cambio de UI debe conservar ese recorrido sin pasos
   manuales extra.

### 2.2 Mapa de módulos del front

```text
src/
├── pages/Scanner.jsx              # orquestador del flujo (consentimiento → análisis → try-on)
├── hooks/
│   ├── useLiveCameraTryOn.js      # getUserMedia + MediaPipe VIDEO + try-on 3D/2D en vivo
│   └── usePhotoTryOn.js           # MediaPipe IMAGE + GLB 3D + recorte 2D + descarga HD
├── lib/
│   ├── api.js                     # cliente HTTP (timeout, health, analyze, recommend, CRUD)
│   ├── imageUtils.js              # brillo y normalización de fotos
│   └── lensCompatibility.js       # reglas lente ↔ montura ↔ rostro
├── components/scanner/
│   ├── FeedbackBox.jsx            # voto 1-5★
│   ├── FrameStrip.jsx             # tira de monturas recomendadas sobre la foto
│   ├── LenteDot.jsx               # muestra de tinte
│   ├── ScanRecord.jsx             # registro visible + descarga JSON del escaneo
│   ├── ScannerMetrics.jsx         # panel morfométrico + corrección de forma
│   ├── TryOnDetail.jsx            # montura probada + lentes compatibles
│   └── RecommendationCard.jsx     # tarjeta de recomendación
└── components/tryon/
    ├── frameStyle.js              # color de armazón + familia de tinte (fuente única)
    ├── arLoader.js                # import() único de Frame3D/Three.js
    ├── Frame3D.js                 # GlassesAR: pose + armazón procedural/GLB
    ├── GlassesGLB.js              # carga, normalización y tintado de GLB
    ├── GlassesOverlay.js          # try-on vectorial 2D (fallback)
    └── PhotoTryOn.js              # recorte 2D fotorrealista (respaldo del 3D en foto)
```

### 2.3 Pasos para un refactor

1. Leer `agent.md` y este archivo.
2. Identificar el límite: ¿lógica pura, efecto de navegador o UI?
3. Extraer sin cambiar comportamiento; mantener exports/props estables.
4. Ejecutar el **gate de verificación** (sección 3).
5. Actualizar `agent.md` y este archivo si cambió estructura, estado o roadmap.
6. Dejar los cambios listos y reportar archivos; **el commit y el deploy los hace
   el usuario** (no commitear desde el agente).

### 2.4 Flujo funcional del escáner

1. Consentimiento Ley 1581 (obligatorio antes de procesar).
2. Entrada: cámara en vivo (MediaPipe VIDEO) o foto subida.
3. `POST /analyze` → forma de cara, simetría, proporciones, IPD, ancho temporal y
   puente nasal.
4. `POST /recommend` → monturas ordenadas por compatibilidad.
5. Probador: GLB 3D sobre la foto o el video; tira de recomendadas y selector de
   montura en la misma vista.
6. Registro local del escaneo + feedback del piloto. La foto no se almacena.

## 3. Gate de verificación

```powershell
# Frontend (raíz de este repo)
npm run lint          # 0 warnings
npm run lint:eslint   # accesibilidad + hooks (0)
npm run lint:css      # stylelint (0)
npm run typecheck     # tsc --checkJs (0)
npm test              # vitest (35)
npm run test:e2e      # playwright (6; `npx playwright install chromium` la primera vez)
npm run build         # 0 errores y ningún chunk > 500 kB
npm run test:pose     # 14/14 verificaciones numéricas
npm run validate:glb  # 8/8 formas con GLB y atribución

# Backend
cd ..\Glassescanner-backend
.\.venv\Scripts\python.exe -m pytest -q   # 38/38
```

Auditoría ampliada (Fase 4 cerrada; ejecutarla al tocar backend):

```powershell
# Frontend
npm audit --omit=dev

# Backend
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m mypy app
.\.venv\Scripts\python.exe -m bandit -r app -q
.\.venv\Scripts\python.exe -m pip_audit --local
.\.venv\Scripts\python.exe -m pytest --cov=app
```

Definición de terminado:

- [ ] `lint`, `lint:eslint`, `lint:css` y `typecheck` sin hallazgos.
- [ ] `npm test` en verde.
- [ ] `npm run test:e2e` en verde (flujo foto → análisis → montura).
- [ ] `build` sin warnings de tamaño (Three.js queda en chunks diferidos).
- [ ] `test:pose` y `validate:glb` en verde.
- [ ] `pytest` en verde si se tocó backend (38/38, cobertura ≥90 %).
- [ ] Documentación actualizada.
- [ ] Sin fotos ni claves reales en el diff.

## 4. Estado verificado (2026-10-30)

- Frontend: build OK en ~0.5 s. `Scanner` = **43.57 kB** (antes 651 kB).
  `Three.js` se descarga solo al activar el 3D (chunks 45/246/352 kB).
- Lint: **0 warnings**; ESLint, Stylelint y `tsc --checkJs`: **0**.
- `test`: **35/35**; `test:e2e`: **6/6**.
- `test:pose`: **14/14**.
- `validate:glb`: **8/8** modelos CC BY 4.0.
- Flujo principal: subir/capturar foto con consentimiento **dispara el análisis
  automáticamente**; las monturas recomendadas aparecen en una tira sobre la
  misma foto y se pueden probar sin bajar a la cuadrícula. En cámara en vivo se
  puede cambiar de montura con el selector y el 3D sigue la pose real.
- Escala del 3D en vivo: sin análisis se usa IPD estándar de **63 mm** para que
  el armazón nazca a tamaño de cara; con análisis se recalcula con la IPD medida
  y el `ancho_total_mm` real.
- Registro del escaneo: forma detectada/confirmada, simetría, IPD, ancho temporal,
  puente nasal, proporciones, cejas, advertencias y top-1; se puede descargar en
  JSON. Es local: no se envía ni se guarda la foto.
- Backend: **38/38 tests**, cobertura **91 %**; Ruff, mypy y bandit sin
  hallazgos. Único riesgo aceptado: `protobuf 4.25.9` (`pip-audit`).
- ML de forma facial: el reentrenamiento con ground truth real **no se desplegó**
  (LOO 13 %, baseline 33 %). El modelo proxy sigue como fallback provisional y la
  corrección manual en `/scanner` es el mecanismo principal.
- Ver `../piloto-rostros/VALIDACION_FORMA_2026-10-25.md`.

## 5. Deuda conocida / próximos pasos

1. Recolectar `n≥60` casos reales de óptica con `forma_real` validada.
2. Reevaluar features (contorno de mandíbula, ángulo gonial, profundidad 3D) antes
   de volver a entrenar. No presentar accuracy no validada en la UI.
3. Recalibrar scoring solo con `n≥30` feedback real (`../RECALIBRACION.md`).
4. Decidir alcance del rebranding Grupo Prisma Visión (empresa vs. producto).
5. Validar los 8 GLB en móvil real (iOS Safari / Android) antes del piloto.
6. Validar en hardware real la cámara en vivo: escala inicial del armazón,
   permisos HTTPS y seguimiento con MediaPipe/WebGL (el E2E los mockea).
7. Limpiar el historial de commits (los mensajes actuales no son descriptivos).

## 6. Riesgos que no se deben reintroducir

- Importar `three` o `Frame3D` estáticamente en `Scanner.jsx`: rompe el code-splitting.
- Duplicar `frameColorHex` o la clasificación de tintes en cada motor.
- Subir a producción un clasificador ML sin validación externa.
- Añadir un GLB sin licencia comercial y sin atribución.
- Guardar fotos o datos biométricos sin consentimiento explícito.
- Volver a `except: pass` en rutas con I/O: los fallos deben quedar en logs
  (`logger.warning(..., exc_info=True)` o `logger.exception`).
- Dimensionar el armazón solo con métricas: la cámara en vivo debe arrancar con
  IPD estándar (63 mm) para no dibujar una montura de ~1 IPD.
- Enviar o persistir el registro del escaneo en el servidor: el registro es local
  y descargable; la foto nunca se almacena.
