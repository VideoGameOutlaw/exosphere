import './style.css';
import { PlanetRenderer } from './renderer.js';
import {
  COLOR_KEYS, PRESETS, SLIDERS, createSettings, decodeSettings, describe, discover, encodeSettings, normalizeSeed,
} from './settings.js';

const byId = (id) => document.getElementById(id);
const GAS_LABELS = { ocean: 'Band', low: 'Light band', high: 'Storm' };
const ROCK_LABELS = { ocean: 'Ocean', low: 'Lowland', high: 'Highland' };
const ROCK_ONLY = ['sea', 'clouds', 'ice'];

function formatSlider(key, value) {
  if (key === 'light') return `${Math.round(value)}°`;
  return `${Math.round(value * 100)}`;
}

function boot() {
  const canvas = byId('sky');
  const panel = byId('panel');
  const renderer = new PlanetRenderer(canvas);
  const mobile = window.matchMedia('(max-width: 860px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let settings = decodeSettings(window.location.hash) ?? createSettings();
  let playing = !reducedMotion.matches;
  let elapsed = 40;
  let previous = performance.now();
  let dirty = true;
  let toastTimer = 0;
  let drag = null;

  function toast(message) {
    window.clearTimeout(toastTimer);
    const node = byId('toast');
    node.textContent = message;
    node.dataset.visible = 'true';
    toastTimer = window.setTimeout(() => { node.dataset.visible = 'false'; }, 2600);
  }

  function layout() {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    renderer.center = mobile.matches ? [0, 0.3] : [-0.2 * Math.min(aspect, 1.9), 0.06];
    dirty = true;
  }

  function sync() {
    const survey = describe(settings);
    const gas = settings.type === 'gas';
    byId('world-name').textContent = survey.name;
    byId('catalog').textContent = survey.catalog;
    byId('klass').textContent = survey.klass;
    byId('stat-radius').textContent = survey.radius;
    byId('stat-day').textContent = survey.day;
    byId('stat-temperature').textContent = survey.temperature;
    byId('stat-moons').textContent = survey.moons;
    byId('seed').value = settings.seed;
    document.title = `${survey.name} — Exosphere`;
    document.documentElement.style.setProperty('--accent', settings.colors.air);

    for (const button of document.querySelectorAll('[data-preset]')) {
      button.setAttribute('aria-pressed', String(button.dataset.preset === settings.preset));
    }
    for (const button of document.querySelectorAll('[data-type]')) {
      button.setAttribute('aria-pressed', String(button.dataset.type === settings.type));
    }
    for (const key of Object.keys(SLIDERS)) {
      const input = byId(`slider-${key}`);
      const range = SLIDERS[key];
      input.value = String(settings[key]);
      input.disabled = gas && ROCK_ONLY.includes(key);
      input.closest('.slider').dataset.disabled = String(input.disabled);
      input.style.setProperty('--fill', `${((settings[key] - range.min) / (range.max - range.min)) * 100}%`);
      byId(`value-${key}`).textContent = input.disabled ? '—' : formatSlider(key, settings[key]);
    }
    byId('label-relief').textContent = gas ? 'Turbulence' : 'Relief';
    for (const key of COLOR_KEYS) byId(`color-${key}`).value = settings.colors[key];
    for (const key of Object.keys(ROCK_LABELS)) byId(`label-${key}`).textContent = (gas ? GAS_LABELS : ROCK_LABELS)[key];
  }

  function apply(next) {
    settings = next;
    dirty = true;
    sync();
  }

  function edit(patch) {
    apply(createSettings({ ...settings, ...patch, preset: null }));
  }

  function selectPreset(id) {
    if (PRESETS[id]) apply(createSettings({ preset: id }));
  }

  function discoverWorld() {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    const seed = `${values[0].toString(36)}-${values[1].toString(36)}`;
    apply(discover(seed));
    toast(`Discovered ${describe(settings).name}`);
  }

  function togglePlayback() {
    playing = !playing;
    previous = performance.now();
    byId('play-toggle').textContent = playing ? '❙❙' : '▶';
    byId('play-toggle').setAttribute('aria-label', playing ? 'Pause rotation' : 'Resume rotation');
  }

  function setPanel(open) {
    panel.dataset.open = String(open);
    byId('panel-toggle').setAttribute('aria-expanded', String(open));
  }

  async function share() {
    const url = new URL(window.location.href);
    url.hash = `world=${encodeSettings(settings)}`;
    window.history.replaceState(null, '', url);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url.href);
      toast('Link to this world copied');
    } catch {
      toast('Link to this world is in the address bar');
    }
  }

  async function exportPng() {
    renderer.render(settings, elapsed);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      toast('The browser could not encode this frame');
      return;
    }
    const link = document.createElement('a');
    const name = describe(settings).name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.href = URL.createObjectURL(blob);
    link.download = `exosphere-${name}-${settings.seed}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    toast('PNG saved at canvas resolution');
  }

  Object.values(PRESETS).forEach((preset, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.dataset.preset = preset.id;
    button.setAttribute('aria-pressed', 'false');
    button.style.setProperty('--a', preset.colors.ocean);
    button.style.setProperty('--b', preset.colors.low);
    button.style.setProperty('--c', preset.colors.air);
    button.innerHTML = `<i aria-hidden="true"></i><span>${preset.name}</span><small>0${index + 1}</small>`;
    button.addEventListener('click', () => selectPreset(preset.id));
    byId('preset-grid').append(button);
  });

  for (const [key, range] of Object.entries(SLIDERS)) {
    const row = document.createElement('label');
    row.className = 'slider';
    row.innerHTML = `<span class="slider-text"><span id="label-${key}">${range.label}</span><output id="value-${key}"></output></span>`
      + `<input id="slider-${key}" type="range" min="${range.min}" max="${range.max}" step="${key === 'light' ? 1 : 0.01}">`;
    byId('slider-list').append(row);
    row.querySelector('input').addEventListener('input', (event) => edit({ [key]: Number(event.target.value) }));
  }

  for (const key of COLOR_KEYS) {
    byId(`color-${key}`).addEventListener('input', (event) => {
      edit({ colors: { ...settings.colors, [key]: event.target.value } });
    });
  }
  for (const button of document.querySelectorAll('[data-type]')) {
    button.addEventListener('click', () => edit({ type: button.dataset.type }));
  }
  byId('seed-form').addEventListener('submit', (event) => {
    event.preventDefault();
    edit({ seed: normalizeSeed(byId('seed').value) });
    byId('seed').blur();
  });
  byId('discover').addEventListener('click', discoverWorld);
  byId('play-toggle').addEventListener('click', togglePlayback);
  byId('reset-view').addEventListener('click', () => { renderer.resetView(); dirty = true; });
  byId('share').addEventListener('click', share);
  byId('export-png').addEventListener('click', exportPng);
  byId('about-open').addEventListener('click', () => byId('about').showModal());
  byId('about-close').addEventListener('click', () => byId('about').close());
  byId('panel-toggle').addEventListener('click', () => setPanel(panel.dataset.open !== 'true'));
  byId('panel-close').addEventListener('click', () => setPanel(false));
  mobile.addEventListener('change', (event) => { setPanel(!event.matches); layout(); });

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    renderer.orbit((event.clientX - drag.x) * 0.006, (event.clientY - drag.y) * 0.006);
    drag = { x: event.clientX, y: event.clientY };
    dirty = true;
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    renderer.zoom(Math.exp(event.deltaY * 0.0012));
    dirty = true;
  }, { passive: false });

  window.addEventListener('resize', layout);
  window.addEventListener('hashchange', () => {
    const shared = decodeSettings(window.location.hash);
    if (shared) {
      apply(shared);
      toast('Shared world loaded');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (byId('about').open || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest('input, select, textarea')) return;
    const key = event.key.toLowerCase();
    if (key === ' ' && event.target.closest('button')) return;
    if (key === ' ') {
      event.preventDefault();
      togglePlayback();
    } else if (key === 'n') discoverWorld();
    else if (key === 'r') { renderer.resetView(); dirty = true; }
    else if (key === 'h') document.body.dataset.uiHidden = String(document.body.dataset.uiHidden !== 'true');
    else if (key === '?') byId('about').showModal();
    else if (/^[1-6]$/.test(key)) selectPreset(Object.keys(PRESETS)[Number(key) - 1]);
  });

  let statsStart = performance.now();
  let statsFrames = 0;
  function frame(now) {
    const delta = Math.min(Math.max((now - previous) / 1000, 0), 0.05);
    previous = now;
    if (playing) elapsed += delta;
    if (playing || dirty) {
      renderer.render(settings, elapsed);
      dirty = false;
      statsFrames += 1;
    }
    if (now - statsStart >= 700) {
      byId('fps').textContent = playing ? `${Math.round((statsFrames * 1000) / (now - statsStart))} fps` : 'paused';
      statsFrames = 0;
      statsStart = now;
    }
    requestAnimationFrame(frame);
  }

  setPanel(!mobile.matches);
  layout();
  sync();
  if (!playing) {
    byId('play-toggle').textContent = '▶';
    byId('play-toggle').setAttribute('aria-label', 'Resume rotation');
  }
  document.documentElement.dataset.renderer = 'ready';
  window.exosphere = {
    renderer,
    getState: () => ({ settings: structuredClone(settings), playing, survey: describe(settings) }),
    sample: (x, y) => {
      renderer.render(settings, elapsed);
      return renderer.samplePixel(x, y);
    },
  };
  requestAnimationFrame(frame);
}

try {
  boot();
} catch (error) {
  document.documentElement.dataset.renderer = 'error';
  byId('unsupported').hidden = false;
  byId('unsupported-message').textContent = error.message || 'The renderer could not start.';
  console.error(error);
}
