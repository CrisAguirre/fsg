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
Para una montura nueva, agregue su forma a CROPS.
"""
from __future__ import annotations

import json
import sys
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
# atravesando la cara.
CROPS = {
    "rectangular": (140, 345, 920, 310),
    "rimless": (240, 290, 720, 280),
    "aviador": (140, 280, 920, 350),
    "cat-eye": (155, 275, 885, 390),
    "cuadrado": (140, 290, 925, 370),
    "oval": (175, 300, 870, 295),
    "redondo": (145, 240, 920, 475),
    "wayfarer": (145, 240, 890, 430),
}


def build_shape(shape: str) -> dict:
    src = FRAMES / f"{shape}.jpg"
    if not src.exists():
        raise FileNotFoundError(src)

    print(f"[{shape}] Procesando imagen...", flush=True)
    img = Image.open(src).convert("RGB")
    rgba = np.array(remove(img))
    rgb = rgba[:, :, :3].astype(np.uint8)
    alpha = rgba[:, :, 3]
    h, w = alpha.shape

    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)

    # El interior del lente es azul/cian; el aro suele ser neutro u oscuro.
    blue = ((b - r) > 10) & ((g - r) > 2) & (b > 25) & (alpha > 8)
    blue_u8 = blue.astype(np.uint8) * 255

    # Cerrar pequeños reflejos y quedarse con los lentes.
    lens = cv2.morphologyEx(
        blue_u8, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    )
    n, labels, stats, cents = cv2.connectedComponentsWithStats(lens, 8)
    min_area = w * h * 0.008
    lens2 = np.zeros_like(lens)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > min_area:
            lens2[labels == i] = 255

    # Rellenar las patillas plegadas/reflejos que quedan dentro del lente.
    contours, _ = cv2.findContours(lens2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(lens2)
    for c in contours:
        if cv2.contourArea(c) > min_area:
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
        if stats[i, cv2.CC_STAT_AREA] > min_area:
            parts.append((stats[i, cv2.CC_STAT_AREA], float(cents[i][0]), float(cents[i][1])))
    if not parts:
        raise RuntimeError(f"{shape}: no se detectaron lentes")
    if len(parts) == 1:
        # Rimless: los dos lentes quedan unidos por el puente; separar por x.
        x0 = int(stats[:, cv2.CC_STAT_LEFT].min())
        x1 = int((stats[:, cv2.CC_STAT_LEFT] + stats[:, cv2.CC_STAT_WIDTH]).max())
        mid = (x0 + x1) / 2
        ys, xs = np.where(filled > 0)
        left = xs < mid
        lens_centers = [
            (float(xs[left].mean()), float(ys[left].mean())),
            (float(xs[~left].mean()), float(ys[~left].mean())),
        ]
    else:
        # Tomar los 2 componentes de mayor área (los dos cristales)
        parts.sort(key=lambda p: p[0], reverse=True)
        lens_centers = [(p[1], p[2]) for p in parts[:2]]

    # Ordenar de izquierda a derecha
    lens_centers.sort(key=lambda p: p[0])

    x, y, cw, ch = CROPS.get(shape, (0, 0, w, h))
    x = max(0, x)
    y = max(0, y)
    cw = min(cw, w - x)
    ch = min(ch, h - y)

    # Asegurar simetría horizontal de los cristales y reflejos en la montura
    mid_x = cw // 2
    f_alpha = frame_crop[:, :, 3].copy()
    left_trans = (f_alpha[:, :mid_x] < 50).sum()
    right_trans = (f_alpha[:, cw - mid_x:] < 50).sum()
    if right_trans > left_trans * 1.5:
        # El cristal derecho quedó transparente pero el izquierdo no: espejar agujero
        hole = np.fliplr(f_alpha[:, cw - mid_x:] == 0)
        f_alpha[:, :mid_x][hole] = 0
    elif left_trans > right_trans * 1.5:
        hole = np.fliplr(f_alpha[:, :mid_x] == 0)
        f_alpha[:, cw - mid_x:][hole] = 0
    frame_crop[:, :, 3] = f_alpha

    # Espejar reflejos del cristal si un lado tiene significativamente más que el otro
    l_alpha = lens_crop[:, :, 3].copy()
    left_refl = (l_alpha[:, :mid_x] > 10).sum()
    right_refl = (l_alpha[:, cw - mid_x:] > 10).sum()
    if right_refl > left_refl * 1.5:
        mirrored = np.fliplr(lens_crop[:, cw - mid_x:])
        mask = mirrored[:, :, 3] > 10
        lens_crop[:, :mid_x][mask] = mirrored[mask]
    elif left_refl > right_refl * 1.5:
        mirrored = np.fliplr(lens_crop[:, :mid_x])
        mask = mirrored[:, :, 3] > 10
        lens_crop[:, cw - mid_x:][mask] = mirrored[mask]

    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(frame_crop).save(
        OUT / f"{shape}-frame.webp", "WEBP", quality=88, method=6
    )
    Image.fromarray(lens_crop).save(
        OUT / f"{shape}-lens.webp", "WEBP", quality=88, method=6
    )

    # Centros ópticos calibrados y simétricos (nivelados al eje de visión)
    lc_x = round((lens_centers[0][0] - x) / cw, 5)
    rc_x = round((lens_centers[1][0] - x) / cw, 5)
    if rc_x - lc_x < 0.42 or lc_x > 0.35 or rc_x < 0.65:
        # Fallback a centros anatómicos simétricos estándar de montura frontal
        lc_x = 0.251
        rc_x = 0.749
    avg_y = round(((lens_centers[0][1] - y) / ch + (lens_centers[1][1] - y) / ch) / 2, 5)
    if avg_y < 0.38 or avg_y > 0.62:
        avg_y = 0.485
    centers = [[lc_x, avg_y], [rc_x, avg_y]]
    ipd_ratio = round(rc_x - lc_x, 5)

    return {
        "frame": f"/tryon/{shape}-frame.webp",
        "lens": f"/tryon/{shape}-lens.webp",
        "width": int(cw),
        "height": int(ch),
        "lensCenters": centers,
        "ipdRatio": ipd_ratio,
    }


def main() -> None:
    manifest = {}
    for shape in CROPS:
        manifest[shape] = build_shape(shape)
        print(f"[OK] {shape}: {manifest[shape]['width']}x{manifest[shape]['height']} "
              f"ipdRatio={manifest[shape]['ipdRatio']} centers={manifest[shape]['lensCenters']}", flush=True)
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Manifest generado exitosamente: {OUT / 'manifest.json'}", flush=True)


if __name__ == "__main__":
    main()
