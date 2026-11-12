"""Genera miniaturas 4:3 de las fotos de catálogo para el informe.

Uso:
    ..\\Glassescanner-backend\\.venv\\Scripts\\python.exe scripts\\build_frame_thumbs.py

Entrada:  public/frames/<forma>.jpg (1200x896)
Salida:   public/frames/thumbs/<forma>.jpg (480x360, fondo blanco, JPEG progresivo)

Las miniaturas pesan ~10 kB frente a ~500 kB de la foto original: el informe
puede mostrar las 10 monturas sin descargar varios megabytes ni romper la
impresión. El front cae a `imagen_url` si una miniatura falta.
"""

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "frames"
OUT = SRC / "thumbs"
SIZE = (480, 360)
QUALITY = 82


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sources = sorted(path for path in SRC.glob("*.jpg") if path.is_file())
    if not sources:
        raise SystemExit(f"No hay fotos de catálogo en {SRC}")

    for src in sources:
        with Image.open(src) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            fitted = ImageOps.contain(image, SIZE, Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", SIZE, "white")
            x = (SIZE[0] - fitted.width) // 2
            y = (SIZE[1] - fitted.height) // 2
            canvas.paste(fitted, (x, y))
            dest = OUT / f"{src.stem}.jpg"
            canvas.save(dest, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024} kB")


if __name__ == "__main__":
    main()
