// Panel flotante del lente: color, intensidad del color y opacidad tipo
// transitions. Se monta sobre el preview del paso 2 y en el probador virtual.
import { useId, useState } from "react";
import { LENS_COLORS, mixLensColor, normalizeLensStyle } from "../tryon/lensStyle.js";

const clampPct = (v) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 100);

/**
 * @param {{
 *   lensStyle: import("../../types").LensStyle,
 *   tint?: string,
 *   onChange: (next: import("../../types").LensStyle) => void,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 */
export default function LensControls({
  lensStyle,
  tint = "monofocal",
  onChange,
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const style = normalizeLensStyle(lensStyle, tint);
  // Muestra el color tal como se verá con la intensidad actual.
  const preview = mixLensColor(style.color, Math.max(0.28, style.intensity));
  const update = (patch) => onChange?.({ ...style, ...patch });

  return (
    <div className={`lensctl ${open ? "lensctl--open" : ""} ${className}`.trim()}>
      <button
        type="button"
        className="lensctl__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        title={open ? "Ocultar controles del lente" : "Ajustar color y opacidad del lente"}
      >
        <span
          className="lensctl__dot"
          style={{ background: preview, opacity: 0.45 + style.opacity * 0.55 }}
          aria-hidden="true"
        />
        <span>Lente</span>
        <span className="lensctl__chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="lensctl__panel" id={`${id}-panel`}>
          <fieldset className="lensctl__group" disabled={disabled}>
            <legend>Color del lente</legend>
            <div className="lensctl__swatches" role="group" aria-label="Colores de lente">
              {LENS_COLORS.map((c) => {
                const active = c.hex.toLowerCase() === style.color.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`lensctl__swatch ${active ? "lensctl__swatch--active" : ""}`}
                    style={{ background: c.hex }}
                    onClick={() => update({ color: c.hex })}
                    aria-label={`Color ${c.label}`}
                    aria-pressed={active}
                    title={c.label}
                  />
                );
              })}
              <label className="lensctl__custom" title="Elegir otro color">
                <input
                  type="color"
                  value={style.color}
                  onChange={(e) => update({ color: e.target.value })}
                  aria-label="Color de lente personalizado"
                />
                <span aria-hidden="true">＋</span>
              </label>
            </div>
          </fieldset>

          <label className="lensctl__slider" htmlFor={`${id}-intensity`}>
            <span>
              Intensidad <b>{clampPct(style.intensity)}%</b>
            </span>
            <input
              id={`${id}-intensity`}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={style.intensity}
              onChange={(e) => update({ intensity: Number(e.target.value) })}
              disabled={disabled}
            />
          </label>

          <label className="lensctl__slider" htmlFor={`${id}-opacity`}>
            <span>
              Opacidad <b>{clampPct(style.opacity)}%</b>
            </span>
            <input
              id={`${id}-opacity`}
              type="range"
              min="0.02"
              max="0.95"
              step="0.01"
              value={style.opacity}
              onChange={(e) => update({ opacity: Number(e.target.value) })}
              disabled={disabled}
            />
          </label>

          <small className="lensctl__hint">
            El tipo de lente fija estos valores; puedes ajustarlos a tu gusto.
          </small>
        </div>
      )}
    </div>
  );
}
