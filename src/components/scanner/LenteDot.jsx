import { LENS_SWATCH } from "../tryon/frameStyle.js";

export default function LenteDot({ tipo }) {
  const c = LENS_SWATCH[tipo] || LENS_SWATCH.monofocal;
  return (
    <span
      title={`Tinte ${tipo}`}
      style={{
        display: "inline-block",
        width: ".8em",
        height: ".8em",
        borderRadius: "50%",
        background: c,
        border: "1px solid rgba(255,255,255,.5)",
        verticalAlign: "baseline",
      }}
    />
  );
}
