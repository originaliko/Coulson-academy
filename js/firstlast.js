// js/firstlast.js

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeCard(entry, color) {
  const firstBlock = entry.first ? `
    <div class="fl-block">
      <div class="tag">First line</div>
      <div class="quote">"${esc(entry.first.line)}"</div>
      <div class="ep-ref">${esc(entry.first.episode_id).toUpperCase()} · ${esc(entry.first.episode_title)}</div>
    </div>` : '';
  const lastBlock = entry.last ? `
    <div class="fl-block">
      <div class="tag">Last line</div>
      <div class="quote">"${esc(entry.last.line)}"</div>
      <div class="ep-ref">${esc(entry.last.episode_id).toUpperCase()} · ${esc(entry.last.episode_title)}</div>
    </div>` : '';
  return `
    <div class="fl-card">
      <div class="fl-card-header">
        <div class="fl-dot" style="background:${color}"></div>${esc(entry.character)}
      </div>
      ${firstBlock}${lastBlock}
    </div>`;
}

export function initFirstLast(stats) {
  const { first_last, characters } = stats;
  const colorMap = Object.fromEntries(characters.map(c => [c.name, c.color]));
  const mainNames = new Set(characters.map(c => c.name));
  const el = document.getElementById('firstlast');

  const mainEntries = first_last.filter(e => mainNames.has(e.character));
  const secondaryEntries = first_last.filter(e => !mainNames.has(e.character));

  const mainCards = mainEntries.map(e => makeCard(e, colorMap[e.character] || '#444')).join('');
  const secondaryCards = secondaryEntries.map(e => makeCard(e, colorMap[e.character] || '#444')).join('');

  el.innerHTML = `
    <h2>First &amp; Last Lines</h2>
    <p class="subtitle">How each character entered and exited the story</p>
    <div class="fl-grid">
      ${mainCards}
      <div class="fl-secondary-cards fl-secondary-hidden" id="fl-secondary">${secondaryCards}</div>
    </div>
    <div class="fl-show-more-wrap">
      <button class="fl-show-more" id="fl-show-more">Show more characters ↓</button>
    </div>
  `;

  document.getElementById('fl-show-more').addEventListener('click', function () {
    document.getElementById('fl-secondary').classList.remove('fl-secondary-hidden');
    this.closest('.fl-show-more-wrap').remove();
  });
}
