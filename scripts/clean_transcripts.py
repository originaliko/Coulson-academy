"""
clean_transcripts.py
Strip malformed and well-formed italic/bold HTML tags from the dialogue column
of every transcript CSV in dataset/transcripts/.

Patterns removed:
  <i>, </i>, i>          (italic tags, including missing-< variant)
  <b>, </b>, b>          (bold tags, including missing-< variant)

Rows whose dialogue is empty or whitespace-only after cleaning are dropped.
Files are rewritten in-place; originals are not backed up.
"""

import csv
import glob
import io
import os
import re

# Matches all italic/bold tag variants, with or without the leading '<'
TAG_RE = re.compile(r'</?[ib]>|[ib]>', re.IGNORECASE)


def clean_dialogue(text: str) -> str:
    """Remove all italic/bold tag variants and strip surrounding whitespace."""
    return TAG_RE.sub('', text).strip()


def clean_file(filepath: str) -> tuple[int, int]:
    """
    Read a transcript CSV, clean the dialogue column, drop empty rows,
    and write the result back in-place.

    Returns (original_row_count, rows_removed).
    """
    with open(filepath, encoding='utf-8', errors='replace', newline='') as f:
        rows = list(csv.reader(f))

    kept = []
    removed = 0

    for row in rows:
        if len(row) < 4:
            # Malformed row — keep as-is (build_data.py skips these anyway)
            kept.append(row)
            continue

        cleaned = clean_dialogue(row[3])

        if not cleaned:
            removed += 1
            continue

        row[3] = cleaned
        kept.append(row)

    # Rewrite in-place using the same quoting style as the original data
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator='\n')
    writer.writerows(kept)

    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write(buf.getvalue())

    return len(rows), removed


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pattern = os.path.join(root, 'dataset', 'transcripts', '*.csv')
    files = sorted(glob.glob(pattern))

    if not files:
        print('No CSV files found.')
        return

    total_removed = 0
    for filepath in files:
        original, removed = clean_file(filepath)
        name = os.path.basename(filepath)
        if removed:
            print(f'  {name}: {original} rows → removed {removed} empty dialogue rows')
        else:
            print(f'  {name}: {original} rows, nothing removed')
        total_removed += removed

    print(f'\nDone. {len(files)} files cleaned, {total_removed} empty rows removed total.')
    print('Run `python scripts/build_data.py` to regenerate stats.json and dialogues.json.')


if __name__ == '__main__':
    main()
