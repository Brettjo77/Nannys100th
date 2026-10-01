"""Resize the original photos into web-sized copies and write photos.json.

Originals live in photos/ (not committed). Output:
  images/full/NNN.jpg   long edge 2400px, for the lightbox
  images/thumb/NNN.jpg  long edge 900px, for the gallery
EXIF (including any GPS) is stripped; orientation is baked in.

Run from the repo root:  python tools/build_images.py
"""
import json
import re
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "photos"
OUT_FULL = ROOT / "images" / "full"
OUT_THUMB = ROOT / "images" / "thumb"
SIZES = {OUT_FULL: (2400, 85), OUT_THUMB: (900, 80)}


def natural_key(p: Path):
    m = re.search(r"-(\d+)$", p.stem)
    return int(m.group(1)) if m else 1  # "Nanny 100th Birthday.jpg" is shot #1


def process(args):
    index, src = args
    name = f"{index:03d}.jpg"
    with Image.open(src) as im:
        taken = im.getexif().get_ifd(0x8769).get(0x9003)  # DateTimeOriginal
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        for out_dir, (edge, quality) in SIZES.items():
            dest = out_dir / name
            if dest.exists() and dest.stat().st_mtime > src.stat().st_mtime:
                continue
            copy = im.copy()
            copy.thumbnail((edge, edge), Image.LANCZOS)
            copy.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
    # Average colour, shown as a placeholder while the photo loads.
    with Image.open(OUT_THUMB / name) as t:
        r, g, b = t.convert("RGB").resize((1, 1), Image.BOX).getpixel((0, 0))
    return {"file": name, "w": w, "h": h, "taken": taken, "c": f"#{r:02x}{g:02x}{b:02x}"}


def main():
    for d in SIZES:
        d.mkdir(parents=True, exist_ok=True)
    sources = sorted(
        (p for p in SRC.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}),
        key=natural_key,
    )
    with ProcessPoolExecutor() as pool:
        photos = list(pool.map(process, enumerate(sources, start=1)))
    (ROOT / "photos.json").write_text(json.dumps(photos, indent=1))
    print(f"Processed {len(photos)} photos")


if __name__ == "__main__":
    main()
