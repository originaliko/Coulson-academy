import pytest, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from build_data import parse_txt_line, episode_id_from_path


# ── parse_txt_line ────────────────────────────────────────────────────────────

def test_parse_normal_line():
    char, line = parse_txt_line("Coulson: Welcome to level seven.")
    assert char == "Coulson"
    assert line == "Welcome to level seven."

def test_parse_line_no_space_after_colon():
    char, line = parse_txt_line("Ward:What the hell?")
    assert char == "Ward"
    assert line == "What the hell?"

def test_parse_lyrics_returns_none():
    assert parse_txt_line("♪ Some song lyrics ♪") is None

def test_parse_empty_line_returns_none():
    assert parse_txt_line("") is None
    assert parse_txt_line("   ") is None

def test_parse_no_colon_returns_none():
    assert parse_txt_line("No colon here at all") is None

def test_parse_strips_whitespace():
    char, line = parse_txt_line("  May :  Don't. ")
    assert char == "May"
    assert line == "Don't."


# ── episode_id_from_path ──────────────────────────────────────────────────────

def test_episode_id_season1_ep1():
    assert episode_id_from_path("dataset/transcripts/Season 1/E01 - Pilot.txt") == "s01e01"

def test_episode_id_season4_ep15():
    assert episode_id_from_path("dataset/transcripts/Season 4/E15 - Self Control.txt") == "s04e15"

def test_episode_id_season5_ep22():
    assert episode_id_from_path("dataset/transcripts/Season 5/E22 - The End.txt") == "s05e22"

def test_episode_id_invalid_raises():
    with pytest.raises(ValueError):
        episode_id_from_path("dataset/transcripts/no_season_here/E01.txt")

def test_episode_id_no_episode_number_raises():
    with pytest.raises(ValueError):
        episode_id_from_path("dataset/transcripts/Season 1/notanep.txt")
