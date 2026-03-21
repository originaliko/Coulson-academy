"""
Generate palettes/all_palettes.json from AoS palette PNG files.

Run this whenever you add new season palette images:
    python scripts/generate_palettes_json.py

Picks up all palettes/aos-sXXeYY-palette.png files automatically.
Requires Pillow: pip install Pillow  (or: brew install pillow)
"""

import json, os
from pathlib import Path
from PIL import Image

def main():
    root = Path(__file__).parent.parent
    palettes_dir = root / "palettes"
    out_path = palettes_dir / "all_palettes.json"

    pngs = sorted(palettes_dir.glob("aos-s*e*-palette.png"))
    if not pngs:
        print(f"No palette PNGs found in {palettes_dir}")
        return

    all_data = []
    for png in pngs:
        img = Image.open(png).convert("RGB")
        w, h = img.size
        # Sample the middle row for representative colors
        mid = h // 2
        colors = [
            f"#{img.getpixel((x, mid))[0]:02x}"
            f"{img.getpixel((x, mid))[1]:02x}"
            f"{img.getpixel((x, mid))[2]:02x}"
            for x in range(w)
        ]
        all_data.append({
            "output": png.name,
            "palette_png": png.name,
            "num_samples": w,
            "colors": colors,
        })
        print(f"  {png.name}: {w} samples")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_data, f, separators=(",", ":"))

    print(f"\nWritten {out_path} ({len(all_data)} episodes)")
    print("Run  python scripts/build_palette_stats.py  to update palette_stats.json")

if __name__ == "__main__":
    main()
