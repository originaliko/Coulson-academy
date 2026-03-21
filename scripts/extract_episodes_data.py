import requests
import json
import time
from dotenv import load_dotenv
import os

load_dotenv()
API_KEY = os.getenv("OMDB_API_KEY")
SERIES = "Buffy the Vampire Slayer"

TOTAL_SEASONS = 7
EPISODES_PER_SEASON = {
    1: 12,
    2: 22,
    3: 22,
    4: 22,
    5: 22,
    6: 22,
    7: 22
}

episodes = []

for season in range(1, TOTAL_SEASONS + 1):
    for ep in range(1, EPISODES_PER_SEASON[season] + 1):

        url = "http://www.omdbapi.com/"
        params = {
            "apikey": API_KEY,
            "t": SERIES,
            "Season": season,
            "Episode": ep
        }

        r = requests.get(url, params=params)
        data = r.json()

        if data.get("Response") == "True":
            entry = {
                "id": f"s{season:02d}e{ep:02d}",
                "season": season,
                "episode": ep,
                "title": data.get("Title"),
                "air_date": data.get("Released"),
                "imdb_rating": float(data["imdbRating"]) if data.get("imdbRating") not in ["N/A", None] else None,
                "imdb_votes": data.get("imdbVotes")
            }

            episodes.append(entry)
            print(f"✔ {entry['id']} {entry['title']}")

        else:
            error = data.get("Error", "Unknown error")
            print(f"✘ Failed S{season}E{ep} -> {error}")
            
        time.sleep(0.2)  # éviter de spam l'API

output = {
    "series": SERIES,
    "total_seasons": TOTAL_SEASONS,
    "total_episodes": len(episodes),
    "episodes": episodes
}

with open("../dataset/episodes_data/buffy_episodes.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print("JSON file created: episodes_data/buffy_episodes.json")

