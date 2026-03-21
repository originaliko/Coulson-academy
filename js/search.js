// js/search.js
import { loadDialogues } from './main.js';

const MAX_RESULTS = 100;

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initSearch(stats) {
  const { episodes, characters } = stats;
  const el = document.getElementById('search');

  // Build episode lookup by id
  const epById = Object.fromEntries(episodes.map(ep => [ep.id, ep]));
  const seasons = [...new Set(episodes.map(ep => ep.season))].sort((a, b) => a - b);
  const charNames = characters.map(c => c.name);

  el.innerHTML = `
    <h2>Search Dialogue</h2>
    <p class="subtitle">Search every line spoken across all ${episodes.length} episodes</p>
    <div class="search-controls">
      <div class="search-row">
        <input class="search-input" id="search-input" type="text" placeholder="Search dialogue…" autocomplete="off">
        <button class="search-btn" id="search-btn">Search</button>
      </div>
      <div class="filter-row">
        <select class="filter-select" id="filter-season">
          <option value="">All seasons</option>
          ${seasons.map(s => `<option value="${s}">Season ${s}</option>`).join('')}
        </select>
        <select class="filter-select" id="filter-character">
          <option value="">All characters</option>
          ${charNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="search-results"></div>
  `;

  const input = el.querySelector('#search-input');
  const btn = el.querySelector('#search-btn');
  const filterSeason = el.querySelector('#filter-season');
  const filterChar = el.querySelector('#filter-character');
  const resultsEl = el.querySelector('#search-results');

  let dialogues = null;
  let fetchTriggered = false;

  function highlight(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  function runSearch() {
    const query = input.value.trim();
    const season = filterSeason.value;
    const character = filterChar.value;

    if (!query) { resultsEl.innerHTML = ''; return; }
    if (!dialogues) { resultsEl.innerHTML = '<p class="result-count">Loading transcript data…</p>'; return; }

    const matches = [];
    for (const [epId, lines] of Object.entries(dialogues)) {
      const ep = epById[epId];
      if (!ep) continue;
      if (season && String(ep.season) !== String(season)) continue;

      for (const entry of lines) {
        if (character && entry.character !== character) continue;
        if (!entry.line.toLowerCase().includes(query.toLowerCase())) continue;
        matches.push({ ep, entry });
        if (matches.length >= MAX_RESULTS) break;
      }
      if (matches.length >= MAX_RESULTS) break;
    }

    if (matches.length === 0) {
      resultsEl.innerHTML = '<p class="result-count">No lines found matching your search.</p>';
      return;
    }

    // Check if we hit the cap
    let countMsg = '';
    if (matches.length === MAX_RESULTS) {
      countMsg = `<p class="result-count">Showing ${MAX_RESULTS} results — refine your search to see more.</p>`;
    } else {
      countMsg = `<p class="result-count">${matches.length} result${matches.length !== 1 ? 's' : ''}</p>`;
    }

    const cards = matches.map(({ ep, entry }) => {
      const epLabel = `S${ep.season}E${String(ep.episode).padStart(2, '0')}`;
      const rating = ep.rating ? `${ep.rating} ★` : '';
      const safeCharacter = esc(entry.character);
      const safeTitle = esc(ep.title);
      const safeLine = highlight(esc(entry.line), query);
      return `
        <div class="result-card">
          <div class="r-meta">${safeCharacter ? safeCharacter.toUpperCase() + ' · ' : ''}${epLabel} · ${safeTitle}${rating ? ' · ' + rating : ''}</div>
          <div class="r-line">${safeLine}</div>
        </div>`;
    }).join('');

    resultsEl.innerHTML = countMsg + cards;
  }

  // Trigger lazy load on first keystroke
  input.addEventListener('keydown', () => {
    if (fetchTriggered) return;
    fetchTriggered = true;
    loadDialogues()
      .then(data => { dialogues = data; })
      .catch(err => {
        resultsEl.innerHTML = `<p class="error-msg">${esc(err.message)}</p>`;
      });
  });

  input.addEventListener('keyup', e => {
    if (e.key === 'Enter') runSearch();
  });
  btn.addEventListener('click', runSearch);
}
