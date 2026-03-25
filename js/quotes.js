// js/quotes.js
// Auto-plays famous quote scenes below the hero stat grid.
// No controls — picks a random scene, plays all lines, then picks another.

const CHARS_PER_MIN   = 1800;
const MIN_DELAY       = 3000; // ms, floor for very short lines
const BETWEEN_SCENES  = 4000; // ms pause before next scene starts

const AVATAR_SLUG = {
  daisy: 'skye',
  skye:  'skye',
};

export function initQuotes(stats) {
  const el = document.getElementById('quotes');
  if (!el) return;

  // Build colorMap from stats so names use character colours
  const colorMap = {};
  (stats.characters || []).forEach(c => { colorMap[c.name.toLowerCase()] = c.color; });

  el.innerHTML = `
    <div class="qs-stage">
      <div class="qs-slot qs-left"></div>
      <div class="qs-slot qs-right"></div>
    </div>
  `;

  const slotLeft  = el.querySelector('.qs-left');
  const slotRight = el.querySelector('.qs-right');

  let scenes      = [];
  let timer       = null;
  let lastSpeaker = null;
  let lastSceneIdx = -1;
  let side        = 'right'; // first flip → 'left'

  fetch('data/quotes.json')
    .then(r => r.json())
    .then(data => { scenes = data; playNextScene(); })
    .catch(() => {}); // fail silently

  const FADE_DURATION = 600; // ms, must match CSS animation

  function playNextScene() {
    if (!scenes.length) return;
    const hasContent = slotLeft.children.length || slotRight.children.length;
    if (hasContent) {
      slotLeft.classList.add('qs-fading');
      slotRight.classList.add('qs-fading');
      timer = setTimeout(startScene, FADE_DURATION);
    } else {
      startScene();
    }
  }

  function startScene() {
    slotLeft.classList.remove('qs-fading');
    slotRight.classList.remove('qs-fading');
    slotLeft.innerHTML  = '';
    slotRight.innerHTML = '';
    lastSpeaker = null;
    side = 'right';
    let idx;
    do { idx = Math.floor(Math.random() * scenes.length); } while (scenes.length > 1 && idx === lastSceneIdx);
    lastSceneIdx = idx;
    playLine(scenes[idx].lines, 0);
  }

  function playLine(lines, idx) {
    if (idx >= lines.length) {
      timer = setTimeout(playNextScene, BETWEEN_SCENES);
      return;
    }
    const line  = lines[idx];
    showLine(line);
    const delay = line.duration ?? Math.max(MIN_DELAY, (line.line.length / CHARS_PER_MIN) * 60000);
    timer = setTimeout(() => playLine(lines, idx + 1), delay);
  }

  const mobileQuery = window.matchMedia('(max-width: 600px)');

  function showLine(lineObj) {
    const speaker = lineObj.speaker || '';
    const isMobile = mobileQuery.matches;

    let slot;
    if (isMobile) {
      slotLeft.innerHTML  = '';
      slotRight.innerHTML = '';
      slot = slotLeft;
      lastSpeaker = speaker;
    } else {
      if (speaker.toLowerCase() !== (lastSpeaker || '').toLowerCase()) {
        side = side === 'left' ? 'right' : 'left';
        lastSpeaker = speaker;
      }
      slot = side === 'left' ? slotLeft : slotRight;
      slot.innerHTML = '';
    }

    const color = lineObj.color || colorMap[speaker.toLowerCase()] || '#444444';

    const speakerEl = document.createElement('div');
    speakerEl.className = 'dl-speaker';

    // Name bar (reuses dl-char styling from explorer)
    if (speaker) {
      const nameEl = document.createElement('span');
      nameEl.className = 'dl-char';
      nameEl.textContent = speaker.charAt(0).toUpperCase() + speaker.slice(1);
      nameEl.style.background = color;
      speakerEl.appendChild(nameEl);
    }

    // Bubble group (dl-char + dl-bubble share width via dl-bubble-group)
    const group = document.createElement('div');
    group.className = 'dl-bubble-group';

    const charBar = speakerEl.querySelector('.dl-char');
    if (charBar) {
      speakerEl.removeChild(charBar);
      group.appendChild(charBar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'dl-bubble';
    bubble.textContent = lineObj.line;
    group.appendChild(bubble);
    speakerEl.appendChild(group);

    // Avatar
    speakerEl.appendChild(makeAvatar(speaker, lineObj.avatar));

    slot.appendChild(speakerEl);
  }

  function makeAvatar(speaker, avatarOverride) {
    const wrap = document.createElement('div');
    wrap.className = 'dl-avatar-wrap';
    const img = document.createElement('img');
    img.className = 'dl-avatar';
    img.alt = speaker;
    const key = avatarOverride || AVATAR_SLUG[speaker.toLowerCase()] || speaker.toLowerCase();
    img.src = `img/pixels/${key}.png`;
    img.onerror = () => { img.src = 'img/pixels/default.png'; };
    wrap.appendChild(img);
    return wrap;
  }

  // Dev helpers — use in browser console to freeze/resume the quotes player
  window.quotesPause  = () => clearTimeout(timer);
  window.quotesResume = () => playNextScene();

  window.colorMap = colorMap;
}
