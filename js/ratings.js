// js/ratings.js
// Requires Chart.js loaded globally from CDN

const SEASON_COLORS = ['#C8251A','#C8860A','#4A90D9','#7B5EA7','#E8D5A3','#2C6E49','#D4847A'];

export function initRatings(stats) {
  const { episodes } = stats;
  const el = document.getElementById('ratings');

  // Build map: episode_id → [character names] for secondary characters (first appearance only)
  const firstAppearanceMap = {};
  (stats.first_last || []).forEach(entry => {
    if (entry.last === null && entry.first) {
      const epId = entry.first.episode_id;
      if (!firstAppearanceMap[epId]) firstAppearanceMap[epId] = [];
      firstAppearanceMap[epId].push(entry.character);
    }
  });

  const seasons = [...new Set(episodes.map(e => e.season))].sort((a, b) => a - b);
  const seasonBtnsHTML = [
    `<button class="season-btn active" data-season="all">All</button>`,
    ...seasons.map(s => `<button class="season-btn" data-season="${s}">S${s}</button>`)
  ].join('');

  el.innerHTML = `
    <h2>Ratings</h2>
    <p class="subtitle" id="ratings-subtitle">All ${episodes.length} episodes · hover for details · color per season</p>
    <div class="ep-controls" style="margin-bottom:16px">${seasonBtnsHTML}</div>
    <div class="chart-wrap" style="height:320px">
      <canvas id="ratings-canvas"></canvas>
    </div>
  `;

  let chart = null;

  function renderChart(season) {
    if (chart) { chart.destroy(); chart = null; }
    el.querySelectorAll('.chart-callout, .chart-first-ring, .chart-first-label').forEach(n => n.remove());

    const filtered = season === 'all'
      ? episodes
      : episodes.filter(e => e.season === Number(season));

    const data = filtered.map((ep, i) => ({
      x: i + 1,
      y: ep.rating,
      label: ep.title,
      season: ep.season,
      id: ep.id,
    }));

    const ratings = data.filter(d => d.y != null).map(d => d.y);
    const yMin = Math.floor(Math.min(...ratings)) - 0.5;
    const yMax = Math.ceil(Math.max(...ratings)) + 0.1;

    let xTickCallback;
    if (season === 'all') {
      const seasonStarts = {};
      filtered.forEach((ep, i) => {
        if (!seasonStarts[ep.season]) seasonStarts[ep.season] = i;
      });
      xTickCallback = val => {
        const match = Object.entries(seasonStarts).find(([, idx]) => idx + 1 === val);
        return match ? `S${match[0]}` : '';
      };
    } else {
      xTickCallback = val => Number.isInteger(val) ? val : '';
    }

    chart = new Chart(document.getElementById('ratings-canvas'), {
      type: 'scatter',
      data: {
        datasets: [{
          data,
          backgroundColor: data.map(d => SEASON_COLORS[d.season - 1]),
          pointRadius: season === 'all' ? 5 : 6,
          pointHoverRadius: season === 'all' ? 7 : 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.raw.label} — ${ctx.raw.y} ★`,
              afterLabel: ctx => {
                const chars = firstAppearanceMap[ctx.raw.id];
                return chars ? `1st appearance · ${chars.join(', ')}` : null;
              },
            }
          }
        },
        scales: {
          x: {
            min: 0.5,
            max: filtered.length + 0.5,
            ticks: {
              color: '#3D3D55',
              font: { size: 13 },
              callback: xTickCallback,
              maxRotation: 0,
            },
            grid: { color: '#2A2A38' },
          },
          y: {
            min: yMin,
            max: yMax,
            ticks: { color: '#3D3D55', font: { size: 13 } },
            grid: { color: '#2A2A38' },
          }
        },
        animation: {
          onComplete: () => {
            addCallouts(chart, data, filtered, el);
            if (season !== 'all') addFirstAppearanceMarkers(chart, filtered, el, firstAppearanceMap);
          }
        }
      }
    });

    const sub = el.querySelector('#ratings-subtitle');
    if (sub) sub.textContent = season === 'all'
      ? `All ${episodes.length} episodes · hover for details · color per season`
      : `Season ${season} · ${filtered.length} episodes · hover for details`;
  }

  el.querySelectorAll('.season-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChart(btn.dataset.season);
    });
  });

  renderChart('all');
}

function addCallouts(chart, data, episodes, el) {
  el.querySelectorAll('.chart-callout').forEach(n => n.remove());
  const wrap = el.querySelector('.chart-wrap');
  const meta = chart.getDatasetMeta(0);

  const ratedEps = episodes.filter(ep => ep.rating != null);
  if (ratedEps.length === 0) return;

  const peakEp = ratedEps.reduce((best, ep) => ep.rating > best.rating ? ep : best);
  const lowEp  = ratedEps.reduce((worst, ep) => ep.rating < worst.rating ? ep : worst);
  const peakIdx = episodes.findIndex(ep => ep.id === peakEp.id);
  const lowIdx  = episodes.findIndex(ep => ep.id === lowEp.id);

  function makeCallout(idx, isLow) {
    if (idx < 0 || !meta.data[idx]) return;
    const pt = meta.data[idx];
    const ep = episodes[idx];
    const div = document.createElement('div');
    div.className = `chart-callout${isLow ? ' low' : ''}`;
    div.textContent = `${ep.rating} ★ ${ep.title}`;
    const wrapRect = wrap.getBoundingClientRect();
    const canvasRect = chart.canvas.getBoundingClientRect();
    const left = canvasRect.left - wrapRect.left + pt.x;
    const top  = canvasRect.top  - wrapRect.top  + pt.y + (isLow ? 12 : -36);
    div.style.cssText = `left:${left}px;top:${top}px;transform:translateX(-50%)`;
    wrap.appendChild(div);
  }

  wrap.style.position = 'relative';
  makeCallout(peakIdx, false);
  makeCallout(lowIdx, true);
}

function addFirstAppearanceMarkers(chart, filtered, el, firstAppearanceMap) {
  el.querySelectorAll('.chart-first-ring').forEach(n => n.remove());
  const wrap = el.querySelector('.chart-wrap');
  const meta = chart.getDatasetMeta(0);
  const wrapRect = wrap.getBoundingClientRect();
  const canvasRect = chart.canvas.getBoundingClientRect();

  wrap.style.position = 'relative';

  filtered.forEach((ep, i) => {
    if (!firstAppearanceMap[ep.id] || !meta.data[i]) return;

    const pt = meta.data[i];
    const left = canvasRect.left - wrapRect.left + pt.x;
    const top  = canvasRect.top  - wrapRect.top -2  + pt.y;
    const color = SEASON_COLORS[ep.season - 1];

    const ring = document.createElement('div');
    ring.className = 'chart-first-ring';
    ring.style.cssText = `left:${left}px;top:${top}px;border-color:${color}`;
    wrap.appendChild(ring);
  });
}
