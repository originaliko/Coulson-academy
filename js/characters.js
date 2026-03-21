// js/characters.js

export function initCharacters(stats) {
  const { characters } = stats;
  const el = document.getElementById('characters');

  el.innerHTML = `
    <h2>Who Speaks The Most</h2>
    <div class="toggle-wrap">
      <div class="toggle-bar">
        <button class="toggle-btn active" data-mode="global">Total lines</button>
        <button class="toggle-btn" data-mode="per">Per appearance</button>
      </div>
    </div>
    <div class="char-bars" id="char-bars"></div>
  `;

  const barsEl = el.querySelector('#char-bars');
  const btns = el.querySelectorAll('.toggle-btn');

  function render(mode) {
    const scored = characters.map(c => ({
      ...c,
      val: mode === 'global' ? c.total_lines : c.lines_per_appearance,
    })).sort((a, b) => b.val - a.val);

    const max = scored[0]?.val || 1;

    barsEl.innerHTML = scored.map(c => {
      const pct = ((c.val / max) * 100).toFixed(1);
      const label = mode === 'global'
        ? c.val.toLocaleString()
        : `${c.val} / ep`;
      return `
        <div class="char-row">
          <div class="char-name">${c.name}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${c.color}"></div>
          </div>
          <div class="bar-val">${label}</div>
        </div>
      `;
    }).join('');
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.mode);
    });
  });

  render('global');
}
