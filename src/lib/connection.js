// Detección de conexiones lentas / ahorro de datos. La app usa esta señal para
// evitar descargas pesadas (GLB, Three.js) y reducir el tamaño de las fotos en
// dispositivos con poca velocidad. Si el navegador no expone Network Information
// API (Safari/Firefox), se asume conexión normal y la app sigue funcionando.

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);
const SLOW_DOWNLINK_MBPS = 1.5;
const SLOW_RTT_MS = 400;

const LABELS = {
  offline: "Sin conexión",
  "save-data": "Ahorro de datos activo",
  "effective-type": "Conexión lenta",
  downlink: "Conexión lenta",
  rtt: "Latencia alta",
  fast: "Conexión rápida",
  manual: "Modo ligero activado",
  "manual-full": "Modo completo",
};

/**
 * @typedef {Object} ConnectionInfo
 * @property {boolean} lightweight
 * @property {boolean} saveData
 * @property {boolean} online
 * @property {string} effectiveType
 * @property {number} downlink
 * @property {number} rtt
 * @property {"offline"|"save-data"|"effective-type"|"downlink"|"rtt"|"fast"|"manual"|"manual-full"} reason
 * @property {string} label
 */

/**
 * Lee la calidad de red del navegador sin depender de APIs propietarias.
 * `preference` permite que el usuario fuerce modo ligero o completo cuando el
 * navegador no expone Network Information API (Safari/Firefox). Offline siempre
 * gana: sin red no tiene sentido "modo completo".
 * @param {any} [nav]
 * @param {boolean|null} [preference] true = forzar ligero, false = forzar completo, null = auto
 * @returns {ConnectionInfo}
 */
export function readConnectionInfo(
  nav = typeof navigator !== "undefined" ? navigator : null,
  preference = null,
) {
  const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;
  const online = nav?.onLine !== false;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  const downlink = Number(connection?.downlink);
  const rtt = Number(connection?.rtt);

  /** @type {"offline"|"save-data"|"effective-type"|"downlink"|"rtt"|"fast"|"manual"|"manual-full"} */
  let reason = "fast";
  if (!online) reason = "offline";
  else if (saveData) reason = "save-data";
  else if (SLOW_EFFECTIVE_TYPES.has(effectiveType)) reason = "effective-type";
  else if (Number.isFinite(downlink) && downlink > 0 && downlink < SLOW_DOWNLINK_MBPS) {
    reason = "downlink";
  } else if (Number.isFinite(rtt) && rtt > SLOW_RTT_MS) {
    reason = "rtt";
  }

  let lightweight = reason !== "fast";
  let label = LABELS[reason];

  if (preference === true && online) {
    lightweight = true;
    reason = "manual";
    label = LABELS.manual;
  } else if (preference === false && online) {
    lightweight = false;
    reason = "manual-full";
    label = LABELS["manual-full"];
  }

  return {
    lightweight,
    saveData,
    online,
    effectiveType,
    downlink: Number.isFinite(downlink) ? downlink : 0,
    rtt: Number.isFinite(rtt) ? rtt : 0,
    reason,
    label,
  };
}
