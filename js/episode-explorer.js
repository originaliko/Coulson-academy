// js/episode-explorer.js
import { loadDialogues } from './main.js';

const OTHER_COLOR = '#444444';

// Build character color map from stats.characters
function buildColorMap(characters) {
  const map = {};
  characters.forEach(c => { map[c.name] = c.color; });
  return map;
}

// Render placeholder dots (gray) using line_count from stats
function renderPlaceholderDots(container, lineCount) {
  container.innerHTML = '';
  for (let i = 0; i < lineCount; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.background = OTHER_COLOR;
    container.appendChild(dot);
  }
}

// Render real dots from dialogue data
function renderDots(container, lines, colorMap) {
  container.innerHTML = '';
  lines.forEach(entry => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.background = colorMap[entry.character] || OTHER_COLOR;
    if (entry.character) dot.dataset.char = entry.character;
    dot.dataset.line = entry.line;
    container.appendChild(dot);
  });
}

function updateInfoBar(bar, ep, topSpeaker) {
  bar.innerHTML = `
    <div>Episode <span>${ep.id.toUpperCase()}</span></div>
    <div>Title <span>${ep.title}</span></div>
    <div>Rating <span>${ep.rating ?? 'N/A'} ★</span></div>
    <div>Lines <span>${ep.line_count}</span></div>
    <div>Top speaker <span>${topSpeaker || '—'}</span></div>
  `;
}

export function initExplorer(stats) {
  const { episodes, characters } = stats;
  const colorMap = buildColorMap(characters);

  // Group episodes by season
  const bySeason = {};
  episodes.forEach(ep => {
    (bySeason[ep.season] = bySeason[ep.season] || []).push(ep);
  });

  const el = document.getElementById('explorer');

  // Build legend HTML
  const legendHTML = characters.map(c =>
    `<div class="char-pill">
       <div class="swatch" style="background:${c.color}"></div>${c.name}
     </div>`
  ).join('') + `<div class="char-pill"><div class="swatch" style="background:${OTHER_COLOR}"></div>Other</div>`;

  // Build season buttons
  const seasons = Object.keys(bySeason).sort((a, b) => a - b);
  const seasonBtnsHTML = seasons.map(s =>
    `<button class="season-btn" data-season="${s}">S${s}</button>`
  ).join('');

  el.innerHTML = `
    <h2>Dialogue Explorer</h2>
    <p class="subtitle">Each dot is one line of dialogue — hover or tap to read it<span class="explorer-instruction"> - or click the ▶ button!</span></p>
    <div class="char-legend">${legendHTML}</div>
    <div class="ep-controls">
      ${seasonBtnsHTML}
      <select class="ep-select" id="ep-select"></select>
      <button class="play-btn" id="play-btn" aria-label="Play episode" title="Play episode">▶</button>
      <button class="speed-btn" id="speed-minus" title="Slower">−</button>
      <span class="speed-display" id="speed-display">1.0s</span>
      <button class="speed-btn" id="speed-plus" title="Faster">+</button>
    </div>
    <div class="dot-grid" id="dot-grid"></div>
    <div class="dot-line-display" id="dot-line-display"><span class="dl-placeholder">Hover a dot to read the line</span></div>
    <div class="ep-info-bar" id="ep-info-bar"></div>
  `;

  const dotGrid = el.querySelector('#dot-grid');
  const epSelect = el.querySelector('#ep-select');
  const infoBar = el.querySelector('#ep-info-bar');
  const lineDisplay = el.querySelector('#dot-line-display');
  const playBtn      = el.querySelector('#play-btn');
  const speedMinus   = el.querySelector('#speed-minus');
  const speedPlus    = el.querySelector('#speed-plus');
  const speedDisplay = el.querySelector('#speed-display');
  const seasonBtns   = el.querySelectorAll('.season-btn');

  let selectedDot  = null;
  let playInterval = null;
  let playIndex    = 0;
  let playSpeed    = 1000; // ms

  function updateSpeedDisplay() {
    speedDisplay.textContent = (playSpeed / 1000).toFixed(1) + 's';
  }

  speedMinus.addEventListener('click', () => {
    playSpeed = Math.min(playSpeed + 100, 3000);
    updateSpeedDisplay();
    if (playInterval) { clearInterval(playInterval); playInterval = setInterval(() => stepFn(), playSpeed); }
  });

  speedPlus.addEventListener('click', () => {
    playSpeed = Math.max(playSpeed - 100, 200);
    updateSpeedDisplay();
    if (playInterval) { clearInterval(playInterval); playInterval = setInterval(() => stepFn(), playSpeed); }
  });

  let stepFn = () => {}; // reference updated when playback starts

  function stopPlayback() {
    if (!playInterval) return;
    clearInterval(playInterval);
    playInterval = null;
    playBtn.textContent = '▶';
    dotGrid.querySelectorAll('.dot.playing').forEach(d => d.classList.remove('playing'));
  }

  function startPlayback() {
    const allDots = Array.from(dotGrid.querySelectorAll('.dot')).filter(d => d.dataset.line);
    if (!allDots.length) return;

    // If a dot is selected, resume from there; otherwise start from beginning
    playIndex = selectedDot ? allDots.indexOf(selectedDot) : 0;
    if (playIndex < 0) playIndex = 0;
    clearSelection();

    playBtn.textContent = '⏸';

    function step() {
      if (playIndex >= allDots.length) {
        stopPlayback();
        lineDisplay.innerHTML = '<span class="dl-placeholder">Hover a dot to read the line</span>';
        return;
      }
      dotGrid.querySelectorAll('.dot.playing').forEach(d => d.classList.remove('playing'));
      const dot = allDots[playIndex];
      dot.classList.add('playing');
      dot.scrollIntoView({ block: 'nearest' });
      showDotLine(dot.dataset.char || null, dot.dataset.line, dot.style.background);
      playIndex++;
    }

    stepFn = step;
    step();
    playInterval = setInterval(step, playSpeed);
  }

  playBtn.addEventListener('click', () => {
    if (playInterval) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });

  const ENDS_WITH_PUNCT = /[.!?,;:\u2026\u201D"']$/;

  function makeCharPill(char, color) {
    const charEl = document.createElement('span');
    charEl.className = 'dl-char';
    charEl.textContent = char;
    if (color) charEl.style.background = color;
    return charEl;
  }

  function showDotLine(char, line, color) {
    lineDisplay.innerHTML = '';
    if (char) lineDisplay.appendChild(makeCharPill(char, color));
    const lineEl = document.createElement('span');
    lineEl.className = 'dl-text';
    lineEl.textContent = line;
    lineDisplay.appendChild(lineEl);
  }

  function showDotRun(clickedDot) {
    const char = clickedDot.dataset.char;
    const color = clickedDot.style.background;
    const allDots = Array.from(dotGrid.querySelectorAll('.dot'));
    const idx = allDots.indexOf(clickedDot);

    let start = idx;
    let end = idx;
    while (start > 0 && allDots[start - 1].dataset.char === char && allDots[start - 1].dataset.line) start--;
    while (end < allDots.length - 1 && allDots[end + 1].dataset.char === char && allDots[end + 1].dataset.line) end++;

    // Merge lines that don't end with punctuation into the following line
    const runDots = allDots.slice(start, end + 1);
    const merged = []; // { text, indices: [original indices] }
    let i = 0;
    while (i < runDots.length) {
      let text = runDots[i].dataset.line;
      const indices = [start + i];
      while (!ENDS_WITH_PUNCT.test(text.trimEnd()) && i + 1 < runDots.length) {
        i++;
        text = text.trimEnd() + ' ' + runDots[i].dataset.line;
        indices.push(start + i);
      }
      merged.push({ text, indices });
      i++;
    }

    if (merged.length === 1) {
      showDotLine(char || null, merged[0].text, color);
      return;
    }

    lineDisplay.innerHTML = '';
    if (char) lineDisplay.appendChild(makeCharPill(char, color));

    const runEl = document.createElement('div');
    runEl.className = 'dl-run-lines';
    merged.forEach(entry => {
      const lineEl = document.createElement('span');
      const isActive = entry.indices.includes(idx);
      lineEl.className = isActive ? 'dl-run-line dl-run-active' : 'dl-run-line';
      lineEl.textContent = entry.text;
      runEl.appendChild(lineEl);
    });
    lineDisplay.appendChild(runEl);
  }

  function resetLineDisplay() {
    if (selectedDot || playInterval) return;
    lineDisplay.innerHTML = '<span class="dl-placeholder">Hover a dot to read the line</span>';
  }

  dotGrid.addEventListener('mouseover', e => {
    if (selectedDot || playInterval) return;
    const dot = e.target.closest('.dot');
    if (!dot || !dot.dataset.line) return;
    showDotLine(dot.dataset.char || null, dot.dataset.line, dot.style.background);
  });
  dotGrid.addEventListener('mouseleave', resetLineDisplay);
  dotGrid.addEventListener('click', e => {
    const dot = e.target.closest('.dot');
    if (!dot || !dot.dataset.line) return;
    if (playInterval) { stopPlayback(); return; }
    // clicking the same dot again deselects
    if (selectedDot === dot) {
      selectedDot.classList.remove('selected');
      selectedDot = null;
      lineDisplay.innerHTML = '<span class="dl-placeholder">Hover a dot to read the line</span>';
      return;
    }
    if (selectedDot) selectedDot.classList.remove('selected');
    selectedDot = dot;
    dot.classList.add('selected');
    showDotRun(dot);
  });

  // Clear selection and stop playback when episode changes
  function clearSelection() {
    stopPlayback();
    if (selectedDot) { selectedDot.classList.remove('selected'); selectedDot = null; }
    lineDisplay.innerHTML = '<span class="dl-placeholder">Hover a dot to read the line</span>';
  }

  let dialoguesData = null;
  let isLoading = false;

  function populateDropdown(season) {
    const eps = bySeason[season] || [];
    epSelect.innerHTML = eps.map(ep =>
      `<option value="${ep.id}">S${ep.season}E${String(ep.episode).padStart(2,'0')} — ${ep.title}</option>`
    ).join('');
  }

  function showEpisode(epId) {
    const ep = episodes.find(e => e.id === epId);
    if (!ep) return;
    clearSelection();
    if (dialoguesData) {
      renderDots(dotGrid, dialoguesData[epId] || [], colorMap);
    } else {
      renderPlaceholderDots(dotGrid, ep.line_count);
    }
    updateInfoBar(infoBar, ep, ep.top_speaker);
  }

  function selectSeason(season) {
    seasonBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.season === String(season));
    });
    populateDropdown(season);
    showEpisode(epSelect.value);
  }

  // Season tab click — triggers lazy load
  seasonBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectSeason(btn.dataset.season);
      if (!dialoguesData && !isLoading) {
        isLoading = true;
        dotGrid.innerHTML = '<p class="loading" style="padding:20px">Loading transcript data…</p>';
        loadDialogues()
          .then(data => {
            dialoguesData = data;
            isLoading = false;
            showEpisode(epSelect.value);
          })
          .catch(err => {
            isLoading = false;
            dotGrid.innerHTML = `<p class="error-msg">${err.message.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</p>`;
          });
      }
    });
  });

  // Episode dropdown change
  epSelect.addEventListener('change', () => showEpisode(epSelect.value));

  // Initial render: season 1, episode 1, placeholder dots
  populateDropdown(seasons[0]);
  seasonBtns[0]?.classList.add('active');
  const firstEp = (bySeason[seasons[0]] || [])[0];
  if (firstEp) showEpisode(firstEp.id);

  // Start loading dialogues immediately in background so colored dots appear without user interaction
  isLoading = true;
  loadDialogues()
    .then(data => {
      dialoguesData = data;
      isLoading = false;
      showEpisode(epSelect.value || (firstEp?.id ?? ''));
    })
    .catch(err => {
      isLoading = false;
      dotGrid.innerHTML = `<p class="error-msg">${err.message.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</p>`;
    });
}
