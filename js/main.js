// js/main.js
// Bootstrap: load stats.json immediately, expose lazy loader for dialogues.json

import { initHero }          from './hero.js';
import { initExplorer }      from './episode-explorer.js';
import { initCharacters }    from './characters.js';
import { initRatings }       from './ratings.js';
import { initPalette }       from './palette.js';
import { initCatchphrases }  from './catchphrases.js';
import { initFirstLast }     from './firstlast.js';
import { initSearch }        from './search.js';
import { initQuotes }        from './quotes.js';

// ── Shared lazy-load promise for dialogues.json ──────────────────────────────
// Note: episode-explorer.js and search.js import this function from main.js,
// creating a circular ES module dependency. This is safe because loadDialogues()
// is only called inside event handlers (never at module evaluation time).
let _dialoguesPromise = null;

export function loadDialogues() {
  if (!_dialoguesPromise) {
    _dialoguesPromise = fetch('data/dialogues.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch(() => {
        throw new Error('Could not load transcript data. Please refresh the page.');
      });
  }
  return _dialoguesPromise;
}

// ── Side-nav IntersectionObserver ────────────────────────────────────────────
function initSideNav() {
  const dots = document.querySelectorAll('.nav-dot');
  const sections = document.querySelectorAll('main section[id]');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        dots.forEach(d => d.classList.remove('active'));
        const dot = document.querySelector(`.nav-dot[href="#${entry.target.id}"]`);
        if (dot) dot.classList.add('active');
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  let stats;
  try {
    const res = await fetch('data/stats.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    stats = await res.json();
  } catch {
    document.querySelector('main').innerHTML =
      '<p class="error-msg" style="margin:40px auto;max-width:960px;padding:32px">Failed to load data. Make sure you are serving the site over HTTP (not file://).</p>';
    return;
  }

  initHero(stats);
  initQuotes(stats);
  initCharacters(stats);
  initExplorer(stats);
  initRatings(stats);
  initPalette(stats);
  initCatchphrases(stats);
  initFirstLast(stats);
  initSearch(stats);
  initSideNav();
}

boot();
