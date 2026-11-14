// Genera los montajes del informe (foto original + dos mejores monturas) cuando
// el usuario abre el informe. Mantiene estados de carga/error y descarta
// respuestas obsoletas si el informe se cierra o se vuelve a abrir.
import { useCallback, useRef, useState } from "react";
import { renderTryOnSnapshots, SNAPSHOT_REASON_MESSAGE } from "../lib/tryOnSnapshot.js";

const EMPTY = { images: [], loading: false, error: "", retryable: false };

export function useReportTryOn({ lightweight = false } = {}) {
  const [state, setState] = useState(EMPTY);
  const runRef = useRef(0);

  const generate = useCallback(async ({ photoUrl, frames, recs, metrics }) => {
    const run = ++runRef.current;
    setState({ images: [], loading: true, error: "", retryable: false });
    try {
      const result = await renderTryOnSnapshots({ photoUrl, frames, recs, metrics, lightweight });
      if (run !== runRef.current) return;
      setState({
        images: result.images,
        loading: false,
        error: result.images.length > 0 ? "" : SNAPSHOT_REASON_MESSAGE[result.reason] || "",
        // Solo tiene sentido reintentar fallos del modelo o del dibujo; si no
        // hay rostro, reintentar la misma foto dará el mismo resultado.
        retryable:
          result.images.length === 0 && (result.reason === "model" || result.reason === "render"),
      });
    } catch {
      if (run !== runRef.current) return;
      setState({
        images: [],
        loading: false,
        error: "No se pudieron generar los montajes. Revisa la conexión e inténtalo de nuevo.",
        retryable: true,
      });
    }
  }, [lightweight]);

  const reset = useCallback(() => {
    runRef.current += 1;
    setState(EMPTY);
  }, []);

  return { ...state, generate, reset };
}
