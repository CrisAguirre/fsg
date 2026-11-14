import { describe, expect, it } from "vitest";
import { readConnectionInfo } from "./connection.js";

const nav = (connection, extra = {}) => ({
  onLine: true,
  connection,
  ...extra,
});

describe("readConnectionInfo", () => {
  it("asume conexión normal cuando el navegador no expone la API", () => {
    const info = readConnectionInfo(nav(undefined));
    expect(info).toMatchObject({
      lightweight: false,
      reason: "fast",
      label: "Conexión rápida",
    });
  });

  it("marca ahorro de datos como modo ligero", () => {
    const info = readConnectionInfo(nav({ saveData: true, effectiveType: "4g" }));
    expect(info.lightweight).toBe(true);
    expect(info.reason).toBe("save-data");
    expect(info.label).toContain("Ahorro");
  });

  it("marca 3G, 2G y slow-2G como conexiones lentas", () => {
    for (const effectiveType of ["3g", "2g", "slow-2g"]) {
      const info = readConnectionInfo(nav({ effectiveType }));
      expect(info.lightweight).toBe(true);
      expect(info.reason).toBe("effective-type");
    }
  });

  it("marca una conexión 4G con downlink bajo o RTT alto como lenta", () => {
    const lowDownlink = readConnectionInfo(nav({ effectiveType: "4g", downlink: 0.8 }));
    expect(lowDownlink.lightweight).toBe(true);
    expect(lowDownlink.reason).toBe("downlink");

    const highRtt = readConnectionInfo(nav({ effectiveType: "4g", downlink: 10, rtt: 600 }));
    expect(highRtt.lightweight).toBe(true);
    expect(highRtt.reason).toBe("rtt");
  });

  it("deja pasar una conexión 4G estable", () => {
    const info = readConnectionInfo(nav({ effectiveType: "4g", downlink: 10, rtt: 80 }));
    expect(info.lightweight).toBe(false);
    expect(info.reason).toBe("fast");
  });

  it("detecta el modo offline aunque no haya API de conexión", () => {
    const info = readConnectionInfo({ onLine: false });
    expect(info.lightweight).toBe(true);
    expect(info.online).toBe(false);
    expect(info.reason).toBe("offline");
    expect(info.label).toBe("Sin conexión");
  });
});
