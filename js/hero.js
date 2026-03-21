// js/hero.js

export function initHero(stats) {
  const { meta } = stats;
  const el = document.getElementById('hero');

  el.innerHTML = `
    <div class="hero-eyebrow">Buffy the Vampire Slayer · 1997–2003</div>
    <h1>Into Every<br><em>Generation</em></h1>
    <div class="hero-tagline">Seven seasons of dialogue, data &amp; darkness</div>
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
