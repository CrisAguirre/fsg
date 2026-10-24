"""Genera recortes 2D fotorrealistas para el probador virtual.

Uso:
    python -m pip install rembg pillow opencv-python numpy
    python scripts/build_tryon_assets.py

Entrada:  public/frames/<forma>.jpg  (fotos de catálogo con fondo)
Salida:   public/tryon/<forma>-frame.webp
          public/tryon/<forma>-lens.webp
          public/tryon/manifest.json

El script separa el aro (opaco) del cristal (translúcido) para que la cara
se vea a través del lente. No requiere que las fotos originales tengan alfa.
Para una montura nueva, agregue su forma a SHAPES y ajuste CROPS si hace falta.
"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "public" / "frames"
OUT = ROOT / "public" / "tryon"

# Recorte (x, y, ancho, alto) sobre la imagen de 1200x896.
# Se recorta al frente de la montura para que las patillas no se dibujen
# atravesando la cara. Ajustar solo si cambia la foto de origen.
CROPS = {
    "rectangular": (140, 345, 920, 310),
    "rimless": (240, 290, 720, 280),
}


def build_shape(shape: str) -> dict:
    src = FRAMES / f"{shape}.jpg"
    if not src.exists():
        raise FileNotFoundError(src)

    img = Image.open(src).convert("RGB")
    rgba = np.array(remove(img))
    rgb = rgba[:, :, :3].astype(np.uint8)
    alpha = rgba[:, :, 3]
    h, w = alpha.shape

    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)

    # El interior del lente es azul/cian; el aro suele ser neutro u oscuro.
    blue = ((b - r) > 15) & ((g - r) > 4) & (b > 28) & (alpha > 8)
    blue_u8 = blue.astype(np.uint8) * 255

    # Cerrar pequeños reflejos y quedarse con los dos lentes.
    lens = cv2.morphologyEx(
        blue_u8, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    )
    n, labels, stats, _ = cv2.connectedComponentsWithStats(lens, 8)
    lens2 = np.zeros_like(lens)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > w * h * 0.012:
            lens2[labels == i] = 255

    # Rellenar las patillas plegadas/reflejos que quedan dentro del lente.
    contours, _ = cv2.findContours(lens2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(lens2)
    for c in contours:
        if cv2.contourArea(c) > w * h * 0.012:
            cv2.drawContours(filled, [c], -1, 255, cv2.FILLED)

    # Aro: al quitar el lente se conserva el borde. Se erosiona un poco para
    # no comerse el aro interior por el antialias del recorte.
    lens_for_frame = cv2.erode(filled, np.ones((5, 5), np.uint8), iterations=1)
    frame_alpha = alpha.copy()
    frame_alpha[lens_for_frame > 0] = 0
    frame_alpha = cv2.GaussianBlur(frame_alpha, (3, 3), 0.6)

    # Cristal: solo píxeles azulados (excluye patillas oscuras) con sus reflejos.
    color_weight = np.clip((b - r - 4) / 42.0, 0, 1)
    lens_alpha = (
        (alpha.astype(np.float32) / 255.0)
        * (filled.astype(np.float32) / 255.0)
        * color_weight
    )
    lens_alpha = cv2.GaussianBlur(lens_alpha, (3, 3), 0.8)
    lens_alpha = np.clip(lens_alpha * 160, 0, 255).astype(np.uint8)

    # Centros de lente antes del recorte.
    n, labels, stats, cents = cv2.connectedComponentsWithStats(filled, 8)
    parts = []
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > w * h * 0.012:
            parts.append((float(cents[i][0]), float(cents[i][1])))
    if not parts:
        raise RuntimeError(f"{shape}: no se detectaron lentes")
    if len(parts) == 1:
        # Rimless: los dos lentes quedan unidos por el puente; separar por x.
        x0 = int(stats[:, cv2.CC_STAT_LEFT].min())
        x1 = int((stats[:, cv2.CC_STAT_LEFT] + stats[:, cv2.CC_STAT_WIDTH]).max())
        mid = (x0 + x1) / 2
        ys, xs = np.where(filled > 0)
        left = xs < mid
        parts = [
            (float(xs[left].mean()), float(ys[left].mean())),
            (float(xs[~left].mean()), float(ys[~left].mean())),
        ]
    parts.sort(key=lambda p: p[0])
    if len(parts) < 2:
        raise RuntimeError(f"{shape}: se esperaban 2 lentes, hay {len(parts)}")

    x, y, cw, ch = CROPS.get(shape, (0, 0, w, h))
    x = max(0, x)
    y = max(0, y)
    cw = min(cw, w - x)
    ch = min(ch, h - y)

    frame_crop = np.dstack([rgb, frame_alpha])[y : y + ch, x : x + cw]
    lens_crop = np.dstack([rgb, lens_alpha])[y : y + ch, x : x + cw]

    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(frame_crop).save(
        OUT / f"{shape}-frame.webp", "WEBP", quality=88, method=6
    )
    Image.fromarray(lens_crop).save(
        OUT / f"{shape}-lens.webp", "WEBP", quality=88, method=6
    )

    centers = [
        [round((px - x) / cw, 5), round((py - y) / ch, 5)] for px, py in parts[:2]
    ]
    return {
        "frame": f"/tryon/{shape}-frame.webp",
        "lens": f"/tryon/{shape}-lens.webp",
        "width": int(cw),
        "height": int(ch),
        "lensCenters": centers,
        "ipdRatio": round(centers[1][0] - centers[0][0], 5),
    }


def main() -> None:
    manifest = {}
    for shape in CROPS:
        manifest[shape] = build_shape(shape)
        print(f"{shape}: {manifest[shape]['width']}x{manifest[shape]['height']} "
              f"ipdRatio={manifest[shape]['ipdRatio']}")
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Manifest: {OUT / 'manifest.json'}")


if __name__ == "__main__":
    main()
