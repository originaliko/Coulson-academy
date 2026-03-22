"""
Extract all unique speaker names from AoS transcripts.

Output: data/speakers.csv
Columns: name, first_episode_id, gender

Each raw name gets its own row (aliases listed separately).
Gender column is left blank for manual editing.

Usage:
    python scripts/extract_speakers.py
"""

import csv, glob, os, re
from pathlib import Path


def episode_id_from_path(filepath):
    parts = Path(filepath).parts
    season_dir = next(
        (p for p in parts if re.match(r'Season\s+\d+', p, re.IGNORECASE)), None
    )
    if not season_dir:
        raise ValueError(f"Cannot find 'Season X' directory in: {filepath}")
    season_num = int(re.search(r'\d+', season_dir).group())
    filename = Path(filepath).name
    ep_match = re.match(r'E(\d+)', filename, re.IGNORECASE)
    if not ep_match:
        raise ValueError(f"Cannot find episode number in filename: {filename}")
    ep_num = int(ep_match.group(1))
    return f"s{season_num:02d}e{ep_num:02d}"


def parse_speaker(raw_line):
    line = raw_line.strip()
    if not line or line.startswith('♪'):
        return None
    if ': ' in line:
        char, _, _ = line.partition(': ')
        return char.strip()
    if ':' in line:
        char, _, _ = line.partition(':')
        return char.strip()
    return None


def main():
    root = Path(__file__).parent.parent
    txt_glob = str(root / "dataset" / "transcripts" / "Season *" / "E*.txt")
    out_path = root / "data" / "speakers.csv"

    # name -> first episode id seen
    first_seen = {}

    for filepath in sorted(glob.glob(txt_glob)):
        ep_id = episode_id_from_path(filepath)
        with open(filepath, encoding="utf-8", errors="replace") as f:
            for raw in f:
                name = parse_speaker(raw)
                if name and name not in first_seen:
                    first_seen[name] = ep_id

    # Sort by first episode, then name
    rows = sorted(first_seen.items(), key=lambda x: (x[1], x[0].lower()))

    os.makedirs(out_path.parent, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "first_episode_id", "gender"])
        for name, ep_id in rows:
            writer.writerow([name, ep_id, ""])

    print(f"Written: {out_path} ({len(rows)} speakers)")


if __name__ == "__main__":
    main()
