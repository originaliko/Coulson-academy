import sys, os
sys.path.insert(0, os.path.dirname(__file__))

def test_normalize_known_alias():
    from build_data import normalize_character, ALIAS_MAP
    assert normalize_character("BUFFY", ALIAS_MAP) == "Buffy"

def test_normalize_case_insensitive():
    from build_data import normalize_character, ALIAS_MAP
    assert normalize_character("buffy summers", ALIAS_MAP) == "Buffy"

def test_normalize_unknown_returns_raw():
    from build_data import normalize_character, ALIAS_MAP
    assert normalize_character("Master", ALIAS_MAP) == "Master"

def test_normalize_empty_returns_empty():
    from build_data import normalize_character, ALIAS_MAP
    assert normalize_character("", ALIAS_MAP) == ""

def test_episode_id_from_filename():
    from build_data import episode_id_from_filename
    assert episode_id_from_filename("S01E01_script.csv") == "s01e01"
    assert episode_id_from_filename("S07E22_script.csv") == "s07e22"

def test_read_csv_rows_count():
    """Smoke test: S01E01 should have >100 rows."""
    from build_data import read_csv_rows
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rows = read_csv_rows(os.path.join(root, "dataset", "transcripts", "S01E01_script.csv"))
    assert len(rows) > 100, f"Expected >100, got {len(rows)}"

def test_read_csv_row_structure():
    from build_data import read_csv_rows
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rows = read_csv_rows(os.path.join(root, "dataset", "transcripts", "S01E01_script.csv"))
    char_rows = [r for r in rows if r["character"]]
    assert len(char_rows) > 0
    r = char_rows[0]
    assert "start" in r and "end" in r and "character" in r and "line" in r
    assert isinstance(r["start"], float)

def test_catchphrase_match_case_insensitive():
    from build_data import phrase_matches
    assert phrase_matches("bloody hell", "Oh, Bloody Hell!") is True

def test_catchphrase_match_substring():
    from build_data import phrase_matches
    assert phrase_matches("Vampire", "That vampire attacked me") is True

def test_catchphrase_no_match():
    from build_data import phrase_matches
    assert phrase_matches("Slayer", "I'm just a normal girl") is False

def test_catchphrase_regex_safe():
    from build_data import phrase_matches
    assert phrase_matches("hell.", "hellmouth") is False

if __name__ == "__main__":
    import traceback, sys
    tests = [test_normalize_known_alias, test_normalize_case_insensitive,
             test_normalize_unknown_returns_raw, test_normalize_empty_returns_empty,
             test_episode_id_from_filename, test_read_csv_rows_count,
             test_read_csv_row_structure,
             test_catchphrase_match_case_insensitive, test_catchphrase_match_substring,
             test_catchphrase_no_match, test_catchphrase_regex_safe]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
        except Exception as e:
            print(f"  FAIL  {t.__name__}: {e}")
            failed += 1
    sys.exit(failed)
