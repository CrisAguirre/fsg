import { useEffect, useState } from "react";
import { applyPwaUpdate, isPwaUpdateReady, onPwaUpdate } from "../../lib/pwa.js";
import "./UpdatePrompt.css";

/**
 * Aviso no bloqueante de versión nueva del PWA. El service worker queda en
 * espera hasta que el usuario pulsa "Actualizar"; entonces se activa y la app
 * recarga una sola vez.
 */
export default function UpdatePrompt() {
  const [available, setAvailable] = useState(() => isPwaUpdateReady());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => onPwaUpdate(() => setAvailable(true)), []);

  if (!available || dismissed) return null;

  const update = () => {
    if (!applyPwaUpdate()) window.location.reload();
  };

  return (
    <div className="update-prompt" role="status" aria-live="polite">
      <p className="update-prompt__text">
        <strong>Nueva versión disponible.</strong> Actualiza para cargar las últimas
        mejoras.
      </p>
      <div className="update-prompt__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={update}>
          Actualizar
        </button>
        <button
          type="button"
          className="btn btn--glass btn--sm"
          onClick={() => setDismissed(true)}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
