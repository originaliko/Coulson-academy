// js/episode-explorer.js
import { loadDialogues } from './main.js';

const OTHER_COLOR = '#888888';
const CHARS_PER_MIN = 2000; // reading speed for auto-play timing

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
    `<div class="char-pill" data-char="${c.name}">
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
      <span class="speed-display" id="speed-display">1.0x</span>
      <button class="speed-btn" id="speed-plus" title="Faster">+</button>
    </div>
    <div class="dot-grid" id="dot-grid"></div>
    <div class="dot-line-display" id="dot-line-display">
      <div class="dl-slot dl-slot-left"><span class="dl-placeholder">Hover a dot to read the line</span></div>
      <div class="dl-slot dl-slot-right"></div>
    </div>
    <div class="ep-info-bar" id="ep-info-bar"></div>
  `;

  const dotGrid    = el.querySelector('#dot-grid');
  const epSelect   = el.querySelector('#ep-select');
  const infoBar    = el.querySelector('#ep-info-bar');
  const slotLeft   = el.querySelector('.dl-slot-left');
  const slotRight  = el.querySelector('.dl-slot-right');
  const playBtn    = el.querySelector('#play-btn');
  const speedMinus = el.querySelector('#speed-minus');
  const speedPlus  = el.querySelector('#speed-plus');
  const speedDisplay = el.querySelector('#speed-display');
  const seasonBtns = el.querySelectorAll('.season-btn');

  const PAGE_CHARS = 180; // max chars per bubble page in auto-play

  let selectedDot       = null;
  let playTimer         = null;
  let pageTimers        = [];
  let playIndex         = 0;
  let playSpeedMult     = 1.0; // multiplier on char-based timing
  let lastDisplayedChar = null;
  let displaySide       = 'right'; // start 'right' so first speaker flips to 'left'

  function updateSpeedDisplay() {
    speedDisplay.textContent = playSpeedMult.toFixed(1) + 'x';
  }

  speedMinus.addEventListener('click', () => {
    playSpeedMult = Math.min(+(playSpeedMult + 0.1).toFixed(1), 3.0);
    updateSpeedDisplay();
  });

  speedPlus.addEventListener('click', () => {
    playSpeedMult = Math.max(+(playSpeedMult - 0.1).toFixed(1), 0.5);
    updateSpeedDisplay();
  });

  function splitPages(text) {
    if (text.length <= PAGE_CHARS) return [text];
    const pages = [];
    const words = text.split(' ');
    let current = '';
    for (const word of words) {
      const next = current ? current + ' ' + word : word;
      if (current && next.length > PAGE_CHARS) {
        pages.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) pages.push(current);
    return pages;
  }

  function clearPageTimers() {
    pageTimers.forEach(t => clearTimeout(t));
    pageTimers = [];
  }

  function stopPlayback() {
    if (!playTimer) return;
    clearTimeout(playTimer);
    clearPageTimers();
    playTimer = null;
    playBtn.textContent = '▶';
    dotGrid.querySelectorAll('.dot.playing').forEach(d => d.classList.remove('playing'));
  }

  function startPlayback() {
    const allDots = Array.from(dotGrid.querySelectorAll('.dot')).filter(d => d.dataset.line);
    if (!allDots.length) return;

    playIndex = selectedDot ? allDots.indexOf(selectedDot) : 0;
    if (playIndex < 0) playIndex = 0;
    clearSelection();

    playBtn.textContent = '⏸';

    function step() {
      if (playIndex >= allDots.length) {
        stopPlayback();
        resetSlots();
        return;
      }
      dotGrid.querySelectorAll('.dot.playing').forEach(d => d.classList.remove('playing'));
      const dot = allDots[playIndex];
      dot.classList.add('playing');
      dot.scrollIntoView({ block: 'nearest' });
      const line = dot.dataset.line || '';
      const pages = splitPages(line);
      // Show first page (not the full text) so pagination is visible
      showDotLine(dot.dataset.char || null, pages[0], dot.style.background);
      playIndex++;

      // Schedule remaining pages
      clearPageTimers();
      const delay = Math.max(1500, (line.length / CHARS_PER_MIN) * 60000 * playSpeedMult);
      if (pages.length > 1) {
        const slot = displaySide === 'left' ? slotLeft : slotRight;
        const initialBubble = slot.querySelector('.dl-bubble');
        if (initialBubble) initialBubble.classList.add('dl-bubble--paged');
        const pageDelay = delay / pages.length;
        for (let p = 1; p < pages.length; p++) {
          pageTimers.push(setTimeout(() => {
            const bubble = slot.querySelector('.dl-bubble');
            if (!bubble) return;
            bubble.textContent = pages[p];
            if (p < pages.length - 1) bubble.classList.add('dl-bubble--paged');
          }, pageDelay * p));
        }
      }
      playTimer = setTimeout(step, delay);
    }

    step();
  }

  playBtn.addEventListener('click', () => {
    if (playTimer) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });

  const ENDS_WITH_PUNCT = /[.!?,;:\u2026\u201D"']$/;

  // Override character name → avatar filename (without .png)
  const AVATAR_SLUG = {
    daisy: 'skye',
  };

  function makeAvatar(char) {
    const wrap = document.createElement('div');
    wrap.className = 'dl-avatar-wrap';
    const img = document.createElement('img');
    img.className = 'dl-avatar';
    img.alt = char || '';
    const key = (char || '').toLowerCase();
    const slug = AVATAR_SLUG[key] || key;
    img.src = `img/pixels/${slug}.png`;
    img.onerror = () => { img.src = 'img/pixels/default.png'; };
    wrap.appendChild(img);
    return wrap;
  }

  function makeCharPill(char, color) {
    const charEl = document.createElement('span');
    charEl.className = 'dl-char';
    charEl.textContent = char;
    if (color) charEl.style.background = color;
    return charEl;
  }

  // Flip side when the speaker changes
  function applySide(char) {
    if (char && char !== lastDisplayedChar) {
      displaySide = displaySide === 'left' ? 'right' : 'left';
      lastDisplayedChar = char;
    }
  }

  function highlightLegend(char) {
    el.querySelectorAll('.char-legend .char-pill').forEach(p => p.classList.remove('active'));
    if (char) {
      const pill = el.querySelector(`.char-legend .char-pill[data-char="${char}"]`);
      if (pill) pill.classList.add('active');
    }
  }

  // Build and insert a speaker column (pill → bubble → avatar) into the correct slot
  function showSpeaker(char, color, bubbleContent) {
    applySide(char);
    highlightLegend(char);
    const slot = displaySide === 'left' ? slotLeft : slotRight;
    slot.innerHTML = '';

    const speaker = document.createElement('div');
    speaker.className = 'dl-speaker';

    const group = document.createElement('div');
    group.className = 'dl-bubble-group';
    if (char) group.appendChild(makeCharPill(char, color));

    const bubble = document.createElement('div');
    bubble.className = 'dl-bubble';
    if (typeof bubbleContent === 'string') {
      bubble.textContent = bubbleContent;
    } else {
      bubble.appendChild(bubbleContent);
    }
    group.appendChild(bubble);
    speaker.appendChild(group);
    speaker.appendChild(makeAvatar(char));

    slot.appendChild(speaker);
  }

  function showDotLine(char, line, color) {
    showSpeaker(char, color, line);
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
    const merged = [];
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
      showSpeaker(char || null, color, merged[0].text);
      return;
    }

    const runEl = document.createElement('div');
    runEl.className = 'dl-run-lines';
    merged.forEach(entry => {
      const lineEl = document.createElement('span');
      const isActive = entry.indices.includes(idx);
      lineEl.className = isActive ? 'dl-run-line dl-run-active' : 'dl-run-line';
      lineEl.textContent = entry.text;
      runEl.appendChild(lineEl);
    });

    showSpeaker(char || null, color, runEl);
  }

  function resetSlots() {
    highlightLegend(null);
    lastDisplayedChar = null;
    displaySide = 'right';
    slotLeft.innerHTML = '<span class="dl-placeholder">Hover a dot to read the line</span>';
    slotRight.innerHTML = '';
  }

  function resetLineDisplay() {
    if (selectedDot || playTimer) return;
    resetSlots();
  }

  dotGrid.addEventListener('mouseover', e => {
    if (selectedDot || playTimer) return;
    const dot = e.target.closest('.dot');
    if (!dot || !dot.dataset.line) return;
    showDotLine(dot.dataset.char || null, dot.dataset.line, dot.style.background);
  });
  dotGrid.addEventListener('mouseleave', resetLineDisplay);
  dotGrid.addEventListener('click', e => {
    const dot = e.target.closest('.dot');
    if (!dot || !dot.dataset.line) return;
    if (playTimer) { stopPlayback(); return; }
    if (selectedDot === dot) {
      selectedDot.classList.remove('selected');
      selectedDot = null;
      resetSlots();
      return;
    }
    if (selectedDot) selectedDot.classList.remove('selected');
    selectedDot = dot;
    dot.classList.add('selected');
    // Reset sides so the clicked speaker always appears on the left
    lastDisplayedChar = null;
    displaySide = 'right';
    slotLeft.innerHTML = '';
    slotRight.innerHTML = '';
    showDotRun(dot);
  });

  // Clear selection and stop playback when episode changes
  function clearSelection() {
    stopPlayback();
    if (selectedDot) { selectedDot.classList.remove('selected'); selectedDot = null; }
    resetSlots();
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

  // Start loading dialogues immediately in background
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
