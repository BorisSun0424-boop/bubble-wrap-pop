const sheet = document.querySelector('#bubble-sheet');
const countEl = document.querySelector('#popped-count');
const totalEl = document.querySelector('#total-count');
const progressEl = document.querySelector('#progress');
const resetButton = document.querySelector('#reset');
const soundButton = document.querySelector('#sound-toggle');
const soundPrompt = document.querySelector('#sound-prompt');

let audioContext;
let soundEnabled = true;
let poppedCount = 0;
let isPointerDown = false;
let total = 0;


function layout() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const columns = width < 430 ? 6 : width < 720 ? 8 : 10;
  const rows = height < 690 ? 4 : width < 620 ? 7 : 5;
  return { columns, rows };
}

function makeBubbles() {
  const { columns, rows } = layout();
  total = columns * rows;
  poppedCount = 0;
  sheet.style.setProperty('--columns', columns);
  sheet.querySelectorAll('.bubble').forEach((bubble) => bubble.remove());

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < total; index += 1) {
    const bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'bubble';
    bubble.setAttribute('aria-label', `第 ${index + 1} 颗泡泡`);
    bubble.style.setProperty('--i', index);
    const seed = Math.sin(index * 12.9898 + 4.1414) * 43758.5453;
    const rand = seed - Math.floor(seed);
    const rand2 = (seed * 1.618) - Math.floor(seed * 1.618);
    bubble.style.setProperty('--scale', (0.972 + rand * 0.05).toFixed(3));
    bubble.style.setProperty('--hx', `${(25 + rand * 14).toFixed(1)}%`);
    bubble.style.setProperty('--hy', `${(15 + rand2 * 14).toFixed(1)}%`);
    bubble.style.setProperty('--rx', `${(47.2 + rand2 * 4.2).toFixed(1)}%`);
    bubble.style.setProperty('--ry', `${(45.8 + rand * 4.6).toFixed(1)}%`);
    bubble.style.setProperty('--tilt', `${(rand * 2 - 1).toFixed(2)}deg`);
    bubble.style.setProperty('--ca', `${(rand * 24).toFixed(1)}deg`);
    bubble.style.setProperty('--blob',
      `${(49.2 + rand * 1.6).toFixed(1)}% ${(49.0 + rand2 * 1.8).toFixed(1)}% ${(49.2 + rand2 * 1.6).toFixed(1)}% ${(49.0 + rand * 1.8).toFixed(1)}% / ` +
      `${(49.4 + rand2 * 1.4).toFixed(1)}% ${(49.2 + rand * 1.4).toFixed(1)}% ${(49.2 + rand2 * 1.4).toFixed(1)}% ${(49.4 + rand * 1.4).toFixed(1)}%`);
    fragment.appendChild(bubble);
  }
  sheet.appendChild(fragment);
  sheet.classList.add('renewing');
  window.setTimeout(() => sheet.classList.remove('renewing'), 700);
  updateStatus();
}

function ensureAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playPop(intensity = 1) {
  if (!soundEnabled) return;
  const ctx = ensureAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.055 + Math.random() * 0.025;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const t = i / data.length;
    const crackle = Math.random() * 2 - 1;
    data[i] = crackle * Math.pow(1 - t, 5) * (0.7 + 0.3 * Math.sin(i * 0.7));
  }

  const noise = ctx.createBufferSource();
  const noiseFilter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  noise.buffer = buffer;
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1900 + Math.random() * 1600;
  noiseFilter.Q.value = 0.65 + Math.random() * 0.5;
  noiseGain.gain.setValueAtTime(0.38 * intensity, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  const snap = ctx.createOscillator();
  const snapGain = ctx.createGain();
  snap.type = 'sine';
  snap.frequency.setValueAtTime(240 + Math.random() * 70, now);
  snap.frequency.exponentialRampToValueAtTime(95, now + 0.038);
  snapGain.gain.setValueAtTime(0.16 * intensity, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  const master = ctx.createGain();
  master.gain.value = 0.82;
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  snap.connect(snapGain).connect(master);
  master.connect(ctx.destination);
  noise.start(now);
  snap.start(now);
  snap.stop(now + 0.05);
}

function popBubble(bubble, pressure = 1) {
  if (!bubble || !bubble.classList.contains('bubble') || bubble.classList.contains('popped')) return;
  bubble.classList.remove('pressing');
  bubble.classList.add('popped', 'burst');
  bubble.setAttribute('aria-pressed', 'true');
  bubble.setAttribute('aria-label', `${bubble.getAttribute('aria-label')}，已捏破`);
  poppedCount += 1;
  playPop(Math.min(1.15, 0.78 + pressure * 0.28));
  if (navigator.vibrate) navigator.vibrate(8);
  updateStatus();
  window.setTimeout(() => bubble.classList.remove('burst'), 260);

  if (poppedCount === total) {
    document.querySelector('#hint').lastChild.textContent = ' 全部捏完了，换一张吧';
  }
}

function updateStatus() {
  countEl.textContent = poppedCount;
  totalEl.textContent = total;
  progressEl.style.width = `${total ? (poppedCount / total) * 100 : 0}%`;
}

function bubbleAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element?.closest('.bubble');
}

sheet.addEventListener('pointerdown', (event) => {
  isPointerDown = true;
  sheet.setPointerCapture?.(event.pointerId);
  const bubble = event.target.closest('.bubble');
  if (bubble && !bubble.classList.contains('popped')) {
    bubble.classList.add('pressing');
    window.setTimeout(() => popBubble(bubble, event.pressure || 1), 45);
  }
});

sheet.addEventListener('pointermove', (event) => {
  if (!isPointerDown) return;
  popBubble(bubbleAtPoint(event.clientX, event.clientY), event.pressure || 0.7);
});

sheet.addEventListener('pointerup', () => { isPointerDown = false; });
sheet.addEventListener('pointercancel', () => { isPointerDown = false; });

sheet.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('bubble')) {
    event.preventDefault();
    popBubble(event.target, 1);
  }
});

resetButton.addEventListener('click', () => {
  const activeMode = document.querySelector('.mode-button.active')?.dataset.mode || 'bubble';
  if (activeMode !== 'bubble') return;
  playPop(0.45);
  makeBubbles();
  document.querySelector('#hint').lastChild.textContent = '按住滑动，也很好玩';
});

soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.setAttribute('aria-label', soundEnabled ? '关闭声音' : '打开声音');
  if (soundEnabled) {
    playPop(0.6);
    soundPrompt.textContent = '声音已打开';
  } else {
    soundPrompt.textContent = '声音已关闭';
  }
  soundPrompt.classList.add('show');
  window.setTimeout(() => soundPrompt.classList.remove('show'), 1200);
});

let previousLayout = layout();
window.addEventListener('resize', () => {
  const next = layout();
  if (next.columns !== previousLayout.columns || next.rows !== previousLayout.rows) {
    previousLayout = next;
    makeBubbles();
  }
});

makeBubbles();
