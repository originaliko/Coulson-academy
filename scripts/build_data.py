import json, glob, re, os
from pathlib import Path

# ── CONFIG ────────────────────────────────────────────────────────────────────

OTHER_COLOR = "#444444"

CHARACTERS = {
    "Coulson":  {"color": "#c9a87c", "aliases": ["COULSON", "Phil Coulson", "Director Coulson", "Phil"]},
    "May":      {"color": "#e05c2a", "aliases": ["MAY", "Melinda May", "Melinda"]},
    "Daisy":    {"color": "#38bdf8", "aliases": ["DAISY", "SKYE", "Skye", "Quake", "Daisy Johnson"]},
    "Fitz":     {"color": "#3b9ef5", "aliases": ["FITZ", "Leo Fitz", "Leo"]},
    "Simmons":  {"color": "#34d399", "aliases": ["SIMMONS", "Jemma Simmons", "Jemma"]},
    "Ward":     {"color": "#64748b", "aliases": ["WARD", "Grant Ward", "Grant"]},
    "Mack":     {"color": "#d4a843", "aliases": ["MACK", "Alphonso Mackenzie", "Mackenzie", "Alphonso"]},
    "Hunter":   {"color": "#f97316", "aliases": ["HUNTER", "Lance Hunter", "Lance"]},
    "Bobbi":    {"color": "#e879a0", "aliases": ["BOBBI", "Bobbi Morse", "Mockingbird", "Morse", "MORSE"]},
    "Yo-Yo":    {"color": "#fb923c", "aliases": ["YO-YO", "Elena Rodriguez", "ELENA", "Elena"]},
    "Deke":     {"color": "#94a3b8", "aliases": ["DEKE", "Deke Shaw"]},
    "Triplett": {"color": "#4ade80", "aliases": ["TRIP", "TRIPLETT", "Antoine Triplett", "Antoine"]},
}

SECONDARY_CHARACTERS = {
    "Hill":        ["Hill", "Maria Hill", "HILL"],
    "Fury":        ["Fury", "Nick Fury", "FURY"],
    "Garrett":     ["Garrett", "GARRETT", "John Garrett"],
    "Raina":       ["Raina", "RAINA"],
    "Talbot":      ["Talbot", "TALBOT", "General Talbot"],
    "Coulson's Dad": ["Robert", "ROBERT"],
    "Lincoln":     ["Lincoln", "LINCOLN", "Lincoln Campbell"],
    "Hive":        ["Hive", "HIVE", "Ward/Hive"],
    "Robbie":      ["Robbie", "ROBBIE", "Ghost Rider", "Reyes", "REYES", "Robbie Reyes"],
    "Aida":        ["Aida", "AIDA"],
    "Peterson":    ["Peterson", "PETERSON", "Mike", "MIKE", "Mike Peterson", "Deathlok", "DEATHLOK"],
    "Calvin":      ["Calvin", "CALVIN", "Cal", "CAL", "Zabo", "ZABO", "Calvin Zabo", "Mr. Hyde"],
    "Jiaying":     ["Jiaying", "JIAYING"],
}

SECONDARY_ALIAS_MAP = {}
for _canonical, _aliases in SECONDARY_CHARACTERS.items():
    for _alias in _aliases:
        SECONDARY_ALIAS_MAP[_alias.lower()] = _canonical

CATCHPHRASES = [
    {"search": "Hail Hydra",             "label": "Hail Hydra"},
    {"search": "Agents of S.H.I.E.L.D.", "label": "Agents of S.H.I.E.L.D."},
    {"search": "Level 7",                "label": "Welcome to Level 7"},
    {"search": "The Bus",                "label": "The Bus"},
    {"search": "magical place",          "label": "Tahiti, it's a magical place"},
    {"search": "If I need a gun",        "label": "If I need a gun"},
    {"search": "lanyard",               "label": "Lanyard"},
    {"search": "The cavalry",            "label": "The cavalry"},
    {"search": "The destroyer",          "label": "The destroyer of worlds"},
]

# ── DERIVED LOOKUP ────────────────────────────────────────────────────────────

ALIAS_MAP = {}
for canonical, info in CHARACTERS.items():
    ALIAS_MAP[canonical.lower()] = canonical
    for alias in info["aliases"]:
        ALIAS_MAP[alias.lower()] = canonical


# ── HELPERS ───────────────────────────────────────────────────────────────────

def parse_txt_line(raw_line):
    """
    Parse 'Character: dialogue' line from AoS transcript TXT files.
    Returns (character, dialogue) tuple, or None if line should be skipped.
    """
    line = raw_line.strip()
    if not line:
        return None
    if line.startswith('♪'):
        return None
    # Split on ': ' (with space)
    if ': ' in line:
        char, _, dialogue = line.partition(': ')
        return char.strip(), dialogue.strip()
    # Fall back to ':' alone (no space after colon)
    if ':' in line:
        char, _, dialogue = line.partition(':')
        return char.strip(), dialogue.strip()
    # No colon at all — skip with warning
    print(f"  WARN: skipping line with no colon: {line[:80]}")
    return None


def episode_id_from_path(filepath):
    """
    Derive episode ID from transcript path.
    'dataset/transcripts/Season 1/E01 - Pilot.txt' -> 's01e01'
    """
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


def normalize_character(raw, alias_map):
    if not raw:
        return raw
    return alias_map.get(raw.strip().lower(), raw.strip())


def phrase_matches(phrase, line):
    return bool(re.search(re.escape(phrase), line, re.IGNORECASE))


def load_episode_meta(root):
    """
    Merge episodes-ratings.json + episodes-details.json into episode_meta dict.
    Authoritative for names: episodes-details.json.
    Authoritative for ratings: episodes-ratings.json.
    """
    ratings_path = os.path.join(root, "dataset", "episodes_data", "episodes-ratings.json")
    details_path = os.path.join(root, "dataset", "episodes_data", "episodes-details.json")

    with open(ratings_path, encoding="utf-8") as f:
        ratings_raw = json.load(f)
    if not ratings_raw:
        raise ValueError(f"Unexpected empty ratings JSON: {ratings_path}")
    with open(details_path, encoding="utf-8") as f:
        details_raw = json.load(f)
    if not details_raw:
        raise ValueError(f"Unexpected empty details JSON: {details_path}")

    # Ratings map: (season_number, episode_number) -> {rating, votes}
    ratings_map = {}
    for season_data in ratings_raw:
        for ep in season_data["episodes"]:
            key = (ep["season_number"], ep["episode_number"])
            ratings_map[key] = {
                "rating": ep.get("vote_average"),
                "votes":  ep.get("num_votes"),
            }

    # Build episode_meta from details (authoritative for names + air_date)
    episode_meta = {}
    for ep in details_raw["tvShow"]["episodes"]:
        key = (ep["season"], ep["episode"])
        ep_id = f"s{ep['season']:02d}e{ep['episode']:02d}"
        air_date = (ep.get("air_date") or "")[:10]  # strip time component
        rating_data = ratings_map.get(key, {})
        episode_meta[ep_id] = {
            "id":       ep_id,
            "season":   ep["season"],
            "episode":  ep["episode"],
            "title":    ep["name"],
            "air_date": air_date,
            "rating":   rating_data.get("rating"),
            "votes":    rating_data.get("votes"),
        }
    return episode_meta


def read_txt_rows(filepath):
    """Read a TXT transcript and return list of {character, line} dicts."""
    rows = []
    with open(filepath, encoding="utf-8", errors="replace") as f:
        for raw in f:
            result = parse_txt_line(raw)
            if result is None:
                continue
            char, dialogue = result
            rows.append({"character": char, "line": dialogue})
    return rows


def accumulate_episode(rows, ep_id, alias_map, stats):
    stats["dialogues"].setdefault(ep_id, [])
    stats["ep_line_count"].setdefault(ep_id, 0)
    stats["ep_top_speaker"].setdefault(ep_id, {})

    for row in rows:
        canonical = normalize_character(row["character"], alias_map)
        entry = {"character": canonical, "line": row["line"]}
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
            if phrase_matches(phrase["search"], row["line"]):
                key = phrase["search"]
                stats["phrase_totals"][key] = stats["phrase_totals"].get(key, 0) + 1
                stats["phrase_by_char"].setdefault(key, {})
                if canonical:
                    stats["phrase_by_char"][key][canonical] = (
                        stats["phrase_by_char"][key].get(canonical, 0) + 1
                    )

        stats["ep_line_count"][ep_id] += 1


def build_stats_json(stats, episode_meta):
    total_lines = sum(stats["ep_line_count"].values())
    rated = [e for e in episode_meta.values() if e.get("rating")]
    peak   = max(rated, key=lambda e: e["rating"]) if rated else list(episode_meta.values())[0]
    lowest = min(rated, key=lambda e: e["rating"]) if rated else list(episode_meta.values())[0]
    top_speaker_name = max(stats["char_lines"], key=stats["char_lines"].get) if stats["char_lines"] else ""

    characters_out = []
    for name in CHARACTERS:
        total    = stats["char_lines"].get(name, 0)
        appeared = len(stats["char_episodes"].get(name, set()))
        characters_out.append({
            "name":               name,
            "color":              CHARACTERS[name]["color"],
            "total_lines":        total,
            "episodes_appeared":  appeared,
            "lines_per_appearance": round(total / appeared) if appeared else 0,
        })

    episodes_out = []
    for ep_id, meta in sorted(episode_meta.items()):
        top_char = ""
        if stats["ep_top_speaker"].get(ep_id):
            top_char = max(stats["ep_top_speaker"][ep_id], key=stats["ep_top_speaker"][ep_id].get)
        episodes_out.append({
            "id":          ep_id,
            "season":      meta["season"],
            "episode":     meta["episode"],
            "title":       meta["title"],
            "air_date":    meta["air_date"],
            "rating":      meta.get("rating"),
            "votes":       meta.get("votes"),
            "line_count":  stats["ep_line_count"].get(ep_id, 0),
            "top_speaker": top_char,
        })

    catchphrases_out = []
    for phrase in CATCHPHRASES:
        key     = phrase["search"]
        by_char = stats["phrase_by_char"].get(key, {})
        total   = sum(by_char.values())
        top     = max(by_char, key=by_char.get) if by_char else ""
        catchphrases_out.append({
            "phrase":        key,
            "label":         phrase["label"],
            "total":         total,
            "top_character": top,
            "by_character":  dict(sorted(by_char.items(), key=lambda x: -x[1])),
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
            "total_lines":    total_lines,
            "total_episodes": len(episode_meta),
            "total_seasons":  len(set(e["season"] for e in episode_meta.values())),
            "peak_rating":    {"value": peak.get("rating"), "episode": peak["id"], "title": peak["title"]},
            "lowest_rating":  {"value": lowest.get("rating"), "episode": lowest["id"], "title": lowest["title"]},
            "top_speaker":    {"character": top_speaker_name, "lines": stats["char_lines"].get(top_speaker_name, 0)},
        },
        "episodes":    episodes_out,
        "characters":  characters_out,
        "catchphrases": catchphrases_out,
        "first_last":  first_last_out,
    }


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    txt_glob     = os.path.join(root, "dataset", "transcripts", "Season *", "E*.txt")
    out_stats    = os.path.join(root, "data", "stats.json")
    out_dialogues = os.path.join(root, "data", "dialogues.json")

    episode_meta = load_episode_meta(root)

    stats = {
        "dialogues": {}, "char_lines": {}, "char_episodes": {},
        "char_first": {}, "char_last": {}, "sec_char_first": {},
        "phrase_totals": {}, "phrase_by_char": {},
        "ep_line_count": {}, "ep_top_speaker": {},
    }

    txt_files = sorted(glob.glob(txt_glob))
    for filepath in txt_files:
        ep_id = episode_id_from_path(filepath)
        rows  = read_txt_rows(filepath)
        accumulate_episode(rows, ep_id, ALIAS_MAP, stats)
        print(f"  processed {ep_id} ({len(rows)} rows)")

    # Ensure all episodes from metadata appear in dialogues (even those without transcripts)
    for ep_id in episode_meta:
        stats["dialogues"].setdefault(ep_id, [])
        stats["ep_line_count"].setdefault(ep_id, 0)

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
