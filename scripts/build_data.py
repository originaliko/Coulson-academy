import csv, json, glob, re, os

# ── CONFIG ──────────────────────────────────────────────────────────────────

OTHER_COLOR = "#444444"

CHARACTERS = {
    "Buffy":    {"color": "#C8251A", "aliases": ["BUFFY", "Buffy Summers", "buffy"]},
    "Willow":   {"color": "#C8860A", "aliases": ["WILLOW", "Willow Rosenberg"]},
    "Xander":   {"color": "#4A90D9", "aliases": ["XANDER", "Xander Harris"]},
    "Giles":    {"color": "#7B5EA7", "aliases": ["GILES", "Rupert Giles"]},
    "Spike":    {"color": "#E8D5A3", "aliases": ["SPIKE", "William"]},
    "Angel":    {"color": "#2C6E49", "aliases": ["ANGEL", "Angelus"]},
    "Anya":     {"color": "#D4847A", "aliases": ["ANYA", "Anyanka", "Anya Jenkins"]},
    "Tara":     {"color": "#7EB5A6", "aliases": ["TARA", "Tara Maclay"]},
    "Cordelia": {"color": "#C9A84C", "aliases": ["CORDELIA", "Cordelia Chase"]},
    "Dawn":     {"color": "#6B9BD2", "aliases": ["DAWN", "Dawn Summers"]},
    "Joyce":    {"color": "#A67C52", "aliases": ["JOYCE", "Joyce Summers"]},
    "Faith":    {"color": "#B5451B", "aliases": ["FAITH", "Faith Lehane"]},
    "Riley":    {"color": "#5C7A5C", "aliases": ["RILEY", "Riley Finn"]},
}

# Secondary characters: tracked for first appearance only (no color, no stats)
# Keys are display names; values are raw transcript name variants to match.
SECONDARY_CHARACTERS = {
    "Harmony":       ["Harmony", "HARMONY"],
    "Amy":           ["Amy", "AMY"],
    "Jenny Calendar":["Ms. Calendar", "Jenny", "Jenny Calendar"],
    "Snyder":        ["Snyder", "SNYDER", "Principal Snyder"],
    "Drusilla":      ["Drusilla", "DRUSILLA"],
    "Jonathan":      ["Jonathan", "JONATHAN"],
    "Wesley":        ["Wesley", "WESLEY"],
    "Warren":        ["WARREN", "Warren"],
    "Andrew":        ["ANDREW", "Andrew"],
    "Robin Wood":    ["PRINCIPAL WOOD", "ROBIN WOOD", "Robin Wood"],
}

SECONDARY_ALIAS_MAP = {}
for _canonical, _aliases in SECONDARY_CHARACTERS.items():
    for _alias in _aliases:
        SECONDARY_ALIAS_MAP[_alias.lower()] = _canonical

CATCHPHRASES = [
    "I'm buffy", "Vampire", "Slayer", "Hellmouth", "Chosen One", "Watcher",
    "Bloody hell", "Bored now", "Five by five"
]

# ── DERIVED LOOKUP ───────────────────────────────────────────────────────────

ALIAS_MAP = {}
for canonical, info in CHARACTERS.items():
    ALIAS_MAP[canonical.lower()] = canonical
    for alias in info["aliases"]:
        ALIAS_MAP[alias.lower()] = canonical


# ── HELPERS ──────────────────────────────────────────────────────────────────

def normalize_character(raw, alias_map):
    """Return canonical character name, or raw value if unknown."""
    if not raw:
        return raw
    return alias_map.get(raw.strip().lower(), raw.strip())


def episode_id_from_filename(filename):
    """'S01E01_script.csv' -> 's01e01'"""
    base = os.path.basename(filename)
    match = re.match(r'(S\d+E\d+)', base, re.IGNORECASE)
    if not match:
        raise ValueError(f"Cannot derive episode id from: {filename}")
    return match.group(1).lower()


def read_csv_rows(filepath):
    """Read a transcript CSV and return list of dicts with normalized fields."""
    rows = []
    with open(filepath, encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for raw in reader:
            if len(raw) < 4:
                continue
            try:
                start = float(raw[0])
                end = float(raw[1])
            except ValueError:
                continue
            rows.append({
                "start": start,
                "end": end,
                "character": raw[2].strip(),
                "line": raw[3].strip(),
            })
    return rows


def phrase_matches(phrase, line):
    """Case-insensitive substring match, regex-safe."""
    return bool(re.search(re.escape(phrase), line, re.IGNORECASE))


def accumulate_episode(rows, ep_id, alias_map, stats):
    """
    Process rows for one episode and accumulate into stats dict.
    """
    stats["dialogues"].setdefault(ep_id, [])
    stats["ep_line_count"][ep_id] = 0
    stats["ep_top_speaker"].setdefault(ep_id, {})

    for row in rows:
        canonical = normalize_character(row["character"], alias_map)
        entry = {
            "start": row["start"],
            "end": row["end"],
            "character": canonical,
            "line": row["line"],
        }
        stats["dialogues"][ep_id].append(entry)

        if canonical:
            stats["char_lines"][canonical] = stats["char_lines"].get(canonical, 0) + 1
            stats["char_episodes"].setdefault(canonical, set()).add(ep_id)
            stats["ep_top_speaker"][ep_id][canonical] = (
                stats["ep_top_speaker"][ep_id].get(canonical, 0) + 1
            )

            if canonical in CHARACTERS:
                if canonical not in stats["char_first"]:
                    stats["char_first"][canonical] = {"line": row["line"], "ep_id": ep_id}
                stats["char_last"][canonical] = {"line": row["line"], "ep_id": ep_id}

            sec_canonical = SECONDARY_ALIAS_MAP.get(row["character"].strip().lower())
            if sec_canonical and sec_canonical not in stats["sec_char_first"]:
                stats["sec_char_first"][sec_canonical] = {"line": row["line"], "ep_id": ep_id}

        for phrase in CATCHPHRASES:
            if phrase_matches(phrase, row["line"]):
                stats["phrase_totals"][phrase] = stats["phrase_totals"].get(phrase, 0) + 1
                stats["phrase_by_char"].setdefault(phrase, {})
                if canonical:
                    stats["phrase_by_char"][phrase][canonical] = (
                        stats["phrase_by_char"][phrase].get(canonical, 0) + 1
                    )

        stats["ep_line_count"][ep_id] += 1


def build_stats_json(stats, episode_meta):
    """Assemble the stats.json structure from accumulated stats."""
    total_lines = sum(stats["ep_line_count"].values())
    peak = max(episode_meta.values(), key=lambda e: e.get("rating") or 0)
    lowest = min(episode_meta.values(), key=lambda e: e.get("rating") or 9999)
    top_speaker_name = max(stats["char_lines"], key=stats["char_lines"].get) if stats["char_lines"] else ""

    characters_out = []
    for name in CHARACTERS:
        total = stats["char_lines"].get(name, 0)
        appeared = len(stats["char_episodes"].get(name, set()))
        characters_out.append({
            "name": name,
            "color": CHARACTERS[name]["color"],
            "total_lines": total,
            "episodes_appeared": appeared,
            "lines_per_appearance": round(total / appeared) if appeared else 0,
        })

    episodes_out = []
    for ep_id, meta in sorted(episode_meta.items()):
        top_char_in_ep = ""
        if stats["ep_top_speaker"].get(ep_id):
            top_char_in_ep = max(stats["ep_top_speaker"][ep_id],
                                 key=stats["ep_top_speaker"][ep_id].get)
        episodes_out.append({
            "id": ep_id,
            "season": meta["season"],
            "episode": meta["episode"],
            "title": meta["title"],
            "air_date": meta["air_date"],
            "rating": meta.get("rating"),
            "line_count": stats["ep_line_count"].get(ep_id, 0),
            "top_speaker": top_char_in_ep,
        })

    catchphrases_out = []
    for phrase in CATCHPHRASES:
        by_char = stats["phrase_by_char"].get(phrase, {})
        total = sum(by_char.values())
        top_char = max(by_char, key=by_char.get) if by_char else ""
        catchphrases_out.append({
            "phrase": phrase,
            "total": total,
            "top_character": top_char,
            "by_character": dict(sorted(by_char.items(), key=lambda x: -x[1])),
        })
    catchphrases_out.sort(key=lambda x: -x["total"])

    first_last_out = []
    for name in CHARACTERS:
        entry = {"character": name}
        if name in stats["char_first"]:
            fl = stats["char_first"][name]
            ep = episode_meta.get(fl["ep_id"], {})
            entry["first"] = {"line": fl["line"], "episode_id": fl["ep_id"],
                              "episode_title": ep.get("title", "")}
        if name in stats["char_last"]:
            ll = stats["char_last"][name]
            ep = episode_meta.get(ll["ep_id"], {})
            entry["last"] = {"line": ll["line"], "episode_id": ll["ep_id"],
                             "episode_title": ep.get("title", "")}
        first_last_out.append(entry)

    for name in SECONDARY_CHARACTERS:
        if name not in stats["sec_char_first"]:
            continue
        fl = stats["sec_char_first"][name]
        ep = episode_meta.get(fl["ep_id"], {})
        first_last_out.append({
            "character": name,
            "first": {"line": fl["line"], "episode_id": fl["ep_id"],
                      "episode_title": ep.get("title", "")},
            "last": None,
        })

    return {
        "meta": {
            "total_lines": total_lines,
            "total_episodes": len(episode_meta),
            "total_seasons": 7,
            "peak_rating": {"value": peak.get("rating"), "episode": peak["id"],
                            "title": peak["title"]},
            "lowest_rating": {"value": lowest.get("rating"), "episode": lowest["id"],
                              "title": lowest["title"]},
            "top_speaker": {"character": top_speaker_name,
                            "lines": stats["char_lines"].get(top_speaker_name, 0)},
        },
        "episodes": episodes_out,
        "characters": characters_out,
        "catchphrases": catchphrases_out,
        "first_last": first_last_out,
    }


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_glob = os.path.join(root, "dataset", "transcripts", "*.csv")
    meta_path = os.path.join(root, "dataset", "episodes_data", "buffy_episodes.json")
    out_stats = os.path.join(root, "data", "stats.json")
    out_dialogues = os.path.join(root, "data", "dialogues.json")

    with open(meta_path, encoding="utf-8") as f:
        raw_meta = json.load(f)
    episode_meta = {ep["id"]: ep for ep in raw_meta["episodes"]}

    stats = {
        "dialogues": {},
        "char_lines": {},
        "char_episodes": {},
        "char_first": {},
        "char_last": {},
        "sec_char_first": {},
        "phrase_totals": {},
        "phrase_by_char": {},
        "ep_line_count": {},
        "ep_top_speaker": {},
    }

    csv_files = sorted(glob.glob(csv_glob))
    for filepath in csv_files:
        ep_id = episode_id_from_filename(filepath)
        rows = read_csv_rows(filepath)
        accumulate_episode(rows, ep_id, ALIAS_MAP, stats)
        print(f"  processed {ep_id} ({len(rows)} rows)")

    for ep_id in episode_meta:
        stats["dialogues"].setdefault(ep_id, [])

    stats_data = build_stats_json(stats, episode_meta)
    os.makedirs(os.path.dirname(out_stats), exist_ok=True)
    with open(out_stats, "w", encoding="utf-8") as f:
        json.dump(stats_data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Written: {out_stats}")

    with open(out_dialogues, "w", encoding="utf-8") as f:
        json.dump(stats["dialogues"], f, ensure_ascii=False, separators=(",", ":"))
    print(f"Written: {out_dialogues}")


if __name__ == "__main__":
    main()
