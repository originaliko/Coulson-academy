# Coulson Academy — Agents of S.H.I.E.L.D. Data & Dialogue

An interactive data visualisation site for Marvel's *Agents of S.H.I.E.L.D.* (7 seasons, 2013–2020).

**[→ Live site](https://originaliko.github.io/Coulson-academy/)**

---

## What's inside

- **Hero stats** — total lines, episodes, peak IMDb rating, top speaker
- **Who Speaks Most** — bar chart for all 12 main characters
- **Episode Explorer** — dot grid where each dot is one line of dialogue
- **IMDb Ratings** — scatter plot of all 136 episodes coloured by season
- **Catchphrases & Keywords** — how often iconic phrases appear across the series
- **First & Last Lines** — how each character entered and exited the story
- **Color Palettes** — dominant colors of each episode (season 1 available)
- **Dialogue Search** — full-text search with season and character filters

---

## Data sources

- Transcript data: fan-sourced AoS episode scripts (seasons 1–5)
- Episode ratings: IMDb via TMDB
- Inspired by: [Friends Viz](https://sheets.works/data-viz/friends)

---

## Running locally

```bash
# Generate stats and dialogues JSON
python scripts/build_data.py

# Generate palette stats (requires palettes/all_palettes.json)
python scripts/build_palette_stats.py

# Serve locally
python -m http.server 8000
```
