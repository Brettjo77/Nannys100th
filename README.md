# Nanny Johnson · 100

Photo gallery from Nanny Johnson's 100th birthday celebration, 20 September 2026.

## Adding or changing photos

1. Put the full-size photos in `photos/` (this folder isn't uploaded to GitHub).
2. Run `python tools/build_images.py` (needs Pillow: `pip install pillow`).
   This makes web-sized copies in `images/`, removes location data, and updates `photos.json`.
3. Commit and push. GitHub Pages republishes automatically.

## Preview locally

```
python -m http.server 8100
```

Then open http://localhost:8100.
