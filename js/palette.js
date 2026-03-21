// js/palette.js

export function initPalette(stats) {
  const { episodes } = stats;
  const el = document.getElementById('palette');

  const bySeason = {};
  episodes.forEach(ep => {
    (bySeason[ep.season] = bySeason[ep.season] || []).push(ep);
  });

  const seasons = Object.keys(bySeason).sort((a, b) => a - b);
  const seasonBtnsHTML = seasons.map(s =>
    `<button class="season-btn" data-season="${s}">S${s}</button>`
  ).join('');

  el.innerHTML = `
    <h2>Color Palettes</h2>
    <p class="subtitle">The dominant colors of every episode, frame by frame</p>
    <div class="ep-controls">
      ${seasonBtnsHTML}
      <select class="ep-select" id="palette-select"></select>
    </div>
    <div class="palette-wrap">
      <img class="palette-img" id="palette-img" alt="Episode color palette" loading="lazy">
      <div class="palette-ep-label" id="palette-ep-label"></div>
      <div class="palette-stats-bar" id="palette-stats-bar"></div>
    </div>
    <div class="palette-records" id="palette-records"></div>
  `;

  const img        = el.querySelector('#palette-img');
  const epSelect   = el.querySelector('#palette-select');
  const epLabel    = el.querySelector('#palette-ep-label');
  const statsBar   = el.querySelector('#palette-stats-bar');
  const recordsEl  = el.querySelector('#palette-records');
  const seasonBtns = el.querySelectorAll('.season-btn');
  const epMap      = Object.fromEntries(episodes.map(e => [e.id, e]));

  let paletteStats = null;
  let rankings     = null;
  let currentEpId  = null;

  fetch('data/palette_stats.json')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      paletteStats = data;
      rankings = computeRankings(data, episodes);
      renderRecords();
      if (currentEpId) updateStatsBar(currentEpId);
    })
    .catch(() => {});

  // ── Helpers ────────────────────────────────────────────────────────────────

  function brightnessLabel(avg_l) {
    if (avg_l < 9)  return 'Very dark';
    if (avg_l < 13) return 'Dark';
    if (avg_l < 18) return 'Medium';
    if (avg_l < 22) return 'Bright';
    return 'Very bright';
  }

  function toneLabel(s) {
    if (s.avg_s < 7)       return 'Greyscale';
    if (s.warm_pct >= 90)  return 'Warm';
    if (s.blue_pct >= 20)  return 'Cool/Blue';
    if (s.green_pct >= 20) return 'Green';
    if (s.warm_pct >= 70)  return 'Mostly warm';
    return 'Mixed';
  }

  function computeRankings(data, episodes) {
    const ids = episodes.map(e => e.id).filter(id => data[id]);

    function rank(key, asc) {
      const sorted = [...ids].sort((a, b) =>
        asc ? data[a][key] - data[b][key] : data[b][key] - data[a][key]
      );
      return { sorted, rankOf: Object.fromEntries(sorted.map((id, i) => [id, i + 1])) };
    }

    return {
      darkest:  rank('avg_l',    true),
      lightest: rank('avg_l',    false),
      colorful: rank('avg_s',    false),
      grey:     rank('avg_s',    true),
      contrast: rank('std_l',    false),
      bluest:   rank('blue_pct', false),
      warmest:  rank('warm_pct', false),
      greenest:  rank('green_pct', false),
    };
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────

  function updateStatsBar(epId) {
    const s = paletteStats?.[epId];
    if (!s) { statsBar.innerHTML = ''; return; }

    const TOP_N = 10;
    const LABELS = {
      darkest: 'darkest', lightest: 'lightest', colorful: 'most colorful',
      grey: 'most grey', contrast: 'most contrast', bluest: 'bluest', warmest: 'warmest',greenest: 'greenest',
    };
    const badges = Object.keys(LABELS)
      .map(key => ({ key, rank: rankings[key].rankOf[epId] }))
      .filter(({ rank }) => rank && rank <= TOP_N)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map(({ key, rank }) => `<span class="psb-badge">#${rank} ${LABELS[key]}</span>`)
      .join('');

    statsBar.innerHTML = `
      <div>Brightness <span>${brightnessLabel(s.avg_l)}</span></div>
      <div>Saturation <span>${s.avg_s.toFixed(1)}%</span></div>
      <div>Tone <span>${toneLabel(s)}</span></div>
      <div>Contrast <span>${s.std_l.toFixed(1)}</span></div>
      ${badges ? `<div class="psb-badges">${badges}</div>` : ''}
    `;
  }

  // ── Records ────────────────────────────────────────────────────────────────

  function renderRecords() {
    const CATEGORIES = [
      { key: 'darkest',  label: 'Darkest' },
      { key: 'lightest', label: 'Lightest' },
      { key: 'colorful', label: 'Most colorful' },
      { key: 'grey',     label: 'Most grey' },
      { key: 'contrast', label: 'Most contrast' },
      { key: 'bluest',   label: 'Coldest' },
      { key: 'warmest',  label: 'Warmest' },
      { key: 'greenest',  label: 'Greenest' },
    ];

    recordsEl.innerHTML = CATEGORIES.map(({ key, label }) => {
      const chips = rankings[key].sorted.slice(0, 3).map(id => {
        const ep = epMap[id];
        if (!ep) return '';
        const code = `S${ep.season}E${String(ep.episode).padStart(2, '0')}`;
        const isActive = id === currentEpId;
        return `<button class="pr-chip${isActive ? ' active' : ''}" data-ep-id="${id}" title="${ep.title}">${code}</button>`;
      }).join('');
      return `<div class="pr-row"><span class="pr-label">${label}</span><div class="pr-chips">${chips}</div></div>`;
    }).join('');

    recordsEl.querySelectorAll('.pr-chip').forEach(chip => {
      chip.addEventListener('click', () => navigateTo(chip.dataset.epId));
    });
  }

  function navigateTo(epId) {
    const ep = epMap[epId];
    if (!ep) return;
    seasonBtns.forEach(btn => {
      if (btn.dataset.season === String(ep.season)) {
        btn.classList.add('active');
        populateDropdown(ep.season);
      } else {
        btn.classList.remove('active');
      }
    });
    epSelect.value = epId;
    showEpisode(epId);
  }

  // ── Core display ───────────────────────────────────────────────────────────

  function showEpisode(epId) {
    currentEpId = epId;
    const ep = epMap[epId];
    if (!ep) return;
    img.src = `palettes/buffy-${epId}-palette.png`;
    img.alt = `${ep.title} colour palette`;
    epLabel.textContent = `S${ep.season}E${String(ep.episode).padStart(2, '0')} — ${ep.title}`;
    if (paletteStats) {
      updateStatsBar(epId);
      recordsEl.querySelectorAll('.pr-chip').forEach(c =>
        c.classList.toggle('active', c.dataset.epId === epId)
      );
    }
  }

  function populateDropdown(season) {
    const eps = bySeason[season] || [];
    epSelect.innerHTML = eps.map(ep =>
      `<option value="${ep.id}">S${ep.season}E${String(ep.episode).padStart(2, '0')} — ${ep.title}</option>`
    ).join('');
  }

  function selectSeason(season) {
    seasonBtns.forEach(btn =>
      btn.classList.toggle('active', btn.dataset.season === String(season))
    );
    populateDropdown(season);
    showEpisode(epSelect.value);
  }

  seasonBtns.forEach(btn => {
    btn.addEventListener('click', () => selectSeason(btn.dataset.season));
  });
  epSelect.addEventListener('change', () => showEpisode(epSelect.value));

  populateDropdown(seasons[0]);
  seasonBtns[0]?.classList.add('active');
  const firstEp = (bySeason[seasons[0]] || [])[0];
  if (firstEp) showEpisode(firstEp.id);
}
