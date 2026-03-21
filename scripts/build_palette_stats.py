#!/usr/bin/env python3
"""
build_palette_stats.py

Reads dataset/palettes/season*.json files, computes per-episode colour
statistics, and writes data/palette_stats.json.

Run this whenever new palette season files are added or regenerated.
"""

import json, math, re, os, glob
from colorsys import rgb_to_hls

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def hex_to_hsl(hex_color):
    """Return (hue 0-360, saturation 0-100, lightness 0-100) from a hex string."""
    h = hex_color.lstrip('#')
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    hue, light, sat = rgb_to_hls(r, g, b)   # Python's colorsys returns H, L, S
    return hue * 360, sat * 100, light * 100


def ep_id_from_filename(filename):
    """'buffy-s02e01-palette.png' → 's02e01'"""
    m = re.search(r'buffy-(s\d+e\d+)-palette', filename or '', re.IGNORECASE)
    return m.group(1).lower() if m else None


def compute_stats(colors):
    """Compute colour statistics for a list of hex color strings."""
    hsl = [hex_to_hsl(c) for c in colors]

    lightnesses = [l for _, _, l in hsl]
    saturations = [s for _, s, _ in hsl]

    avg_l = sum(lightnesses) / len(lightnesses)
    avg_s = sum(saturations) / len(saturations)
    std_l = math.sqrt(sum((l - avg_l) ** 2 for l in lightnesses) / len(lightnesses))

    # Hue analysis — only count colours with meaningful saturation to exclude greys
    SAT_THRESHOLD = 15
    colored = [(h, s, l) for h, s, l in hsl if s > SAT_THRESHOLD]
    n = len(colored) or 1

    warm_pct  = round(100 * sum(1 for h, *_ in colored if h < 80 or h >= 330) / n)
    blue_pct  = round(100 * sum(1 for h, *_ in colored if 180 <= h < 260) / n)
    green_pct = round(100 * sum(1 for h, *_ in colored if 80 <= h < 160) / n)

    return {
        "avg_l":      round(avg_l, 1),   # average lightness  (0-100)
        "avg_s":      round(avg_s, 1),   # average saturation (0-100)
        "std_l":      round(std_l, 1),   # lightness std dev  (contrast)
        "warm_pct":   warm_pct,          # % of saturated colours that are warm
        "blue_pct":   blue_pct,          # % of saturated colours that are blue
        "green_pct":  green_pct,         # % of saturated colours that are green
    }


def main():
    palette_dir = os.path.join(ROOT, "dataset", "palettes")
    out_path    = os.path.join(ROOT, "data", "palette_stats.json")

    season_files = sorted(
        glob.glob(os.path.join(palette_dir, "*[Ss]eason*.json")),
        key=lambda p: p.lower()
    )

    if not season_files:
        print(f"No season JSON files found in {palette_dir}")
        return

    result = {}
    for path in season_files:
        with open(path, encoding="utf-8") as f:
            episodes = json.load(f)
        for ep in episodes:
            palette_file = ep.get("palette_png") or ep.get("output", "")
            eid = ep_id_from_filename(palette_file)
            if not eid or not ep.get("colors"):
                continue
            result[eid] = compute_stats(ep["colors"])
            s = result[eid]
            print(f"  {eid}  brightness={s['avg_l']:5.1f}  saturation={s['avg_s']:4.1f}"
                  f"  contrast={s['std_l']:4.1f}  warm={s['warm_pct']:3d}%"
                  f"  blue={s['blue_pct']:3d}%  green={s['green_pct']:3d}%")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, separators=(",", ":"))

    print(f"\n✓ Written {len(result)} episodes → {out_path}")


if __name__ == "__main__":
    main()
