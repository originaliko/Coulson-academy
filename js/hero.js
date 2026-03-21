// js/hero.js

export function initHero(stats) {
  const { meta } = stats;
  const el = document.getElementById('hero');

  el.innerHTML = `
    <div class="hero-banner">
      <div class="hero-shield" role="img" aria-label="S.H.I.E.L.D. logo"></div>
      <div class="hero-title-svg" role="img" aria-label="Coulson Academy"></div>
    </div>
    <div class="hero-eyebrow">Agents of S.H.I.E.L.D. · 2013–2020</div>
    <div class="hero-tagline">Seven seasons of dialogue, data &amp; classified intel</div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="num">${meta.total_lines.toLocaleString()}</div>
        <div class="lbl">Lines of dialogue</div>
      </div>
      <div class="stat-card">
        <div class="num">${meta.total_episodes}</div>
        <div class="lbl">Episodes</div>
      </div>
      <div class="stat-card">
        <div class="num">${meta.peak_rating.value}</div>
        <div class="lbl">Peak IMDb rating</div>
      </div>
      <div class="stat-card">
        <div class="num">${meta.top_speaker.character}</div>
        <div class="lbl">Top speaker</div>
      </div>
      <div class="stat-card">
        <div class="num">${meta.total_seasons}</div>
        <div class="lbl">Seasons</div>
      </div>
    </div>
  `;
}
