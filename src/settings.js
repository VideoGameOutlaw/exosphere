export const VERSION = 1;

export const SLIDERS = {
  sea: { min: 0, max: 1, label: 'Ocean level' },
  relief: { min: 0, max: 1, label: 'Relief' },
  clouds: { min: 0, max: 1, label: 'Clouds' },
  atmosphere: { min: 0, max: 1, label: 'Atmosphere' },
  ice: { min: 0, max: 1, label: 'Ice caps' },
  rings: { min: 0, max: 1, label: 'Rings' },
  light: { min: -160, max: 160, label: 'Light angle' },
  spin: { min: 0, max: 1, label: 'Spin' },
};

export const COLOR_KEYS = ['ocean', 'low', 'high', 'air'];

export const PRESETS = {
  tellus: {
    id: 'tellus', name: 'Tellus', type: 'rock', seed: 'tellus-prime',
    sea: 0.52, relief: 0.6, clouds: 0.5, atmosphere: 0.55, ice: 0.45, rings: 0, light: 64, spin: 0.35, emissive: 0,
    colors: { ocean: '#0d3f7a', low: '#3d7a3a', high: '#8b6e4c', air: '#6fb1ff' },
  },
  sirocco: {
    id: 'sirocco', name: 'Sirocco', type: 'rock', seed: 'sirocco-iv',
    sea: 0.14, relief: 0.8, clouds: 0.14, atmosphere: 0.38, ice: 0.05, rings: 0, light: 58, spin: 0.25, emissive: 0,
    colors: { ocean: '#1c5c60', low: '#c98a4b', high: '#7a3f22', air: '#ffb27a' },
  },
  boreas: {
    id: 'boreas', name: 'Boreas', type: 'rock', seed: 'boreas-ii',
    sea: 0.46, relief: 0.5, clouds: 0.34, atmosphere: 0.5, ice: 1, rings: 0.28, light: -48, spin: 0.2, emissive: 0,
    colors: { ocean: '#123f63', low: '#a9c6d6', high: '#e6f1f8', air: '#a8e0ff' },
  },
  cinder: {
    id: 'cinder', name: 'Cinder', type: 'rock', seed: 'cinder-vii',
    sea: 0.42, relief: 0.9, clouds: 0.06, atmosphere: 0.32, ice: 0, rings: 0, light: 70, spin: 0.3, emissive: 1,
    colors: { ocean: '#ff5a14', low: '#2b1e1c', high: '#5a433a', air: '#ff7a3c' },
  },
  thalassa: {
    id: 'thalassa', name: 'Thalassa', type: 'rock', seed: 'thalassa-iii',
    sea: 0.84, relief: 0.4, clouds: 0.66, atmosphere: 0.7, ice: 0.2, rings: 0, light: -58, spin: 0.4, emissive: 0,
    colors: { ocean: '#075286', low: '#2f9a7a', high: '#d9c9a0', air: '#5fd0ff' },
  },
  aurelia: {
    id: 'aurelia', name: 'Aurelia', type: 'gas', seed: 'aurelia-vi',
    sea: 0.5, relief: 0.55, clouds: 0, atmosphere: 0.5, ice: 0, rings: 0.85, light: 48, spin: 0.6, emissive: 0,
    colors: { ocean: '#c79a62', low: '#ecdcb6', high: '#8a563a', air: '#ffd9a0' },
  },
};

export const DEFAULT_PRESET = 'tellus';

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (value, min, max) => Math.round(Math.min(max, Math.max(min, value)) * 1000) / 1000;

export function normalizeSeed(seed) {
  const cleaned = String(seed ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
  return cleaned || 'exosphere';
}

function xmur3(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function createRandom(seed) {
  let a = xmur3(normalizeSeed(seed))();
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOffset(seed) {
  const random = createRandom(`${normalizeSeed(seed)}/offset`);
  return [random() * 80 + 3, random() * 80 + 3, random() * 80 + 3];
}

export function createSettings(input = {}) {
  const base = PRESETS[input.preset] ?? PRESETS[DEFAULT_PRESET];
  const settings = {
    preset: PRESETS[input.preset] ? input.preset : (input.preset === null ? null : base.id),
    type: input.type === 'gas' || input.type === 'rock' ? input.type : base.type,
    seed: normalizeSeed(input.seed ?? base.seed),
    emissive: clamp(Number.isFinite(input.emissive) ? input.emissive : base.emissive, 0, 1),
    colors: {},
  };
  for (const [key, range] of Object.entries(SLIDERS)) {
    const value = Number.isFinite(input[key]) ? input[key] : base[key];
    settings[key] = clamp(value, range.min, range.max);
  }
  for (const key of COLOR_KEYS) {
    const value = input.colors?.[key];
    settings.colors[key] = typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : base.colors[key];
  }
  return settings;
}

function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function discover(seed) {
  const cleanSeed = normalizeSeed(seed);
  const random = createRandom(`${cleanSeed}/discover`);
  const range = (min, max) => min + random() * (max - min);
  const hue = random() * 360;
  const roll = random();

  if (roll < 0.22) {
    return createSettings({
      preset: null, type: 'gas', seed: cleanSeed,
      sea: 0.5, relief: range(0.25, 0.95), clouds: 0, atmosphere: range(0.35, 0.7), ice: 0,
      rings: random() < 0.6 ? range(0.45, 1) : 0, light: range(-70, 70), spin: range(0.35, 0.8), emissive: 0,
      colors: {
        ocean: hslToHex(hue, range(0.3, 0.6), range(0.45, 0.6)),
        low: hslToHex(hue + range(-25, 25), range(0.25, 0.5), range(0.72, 0.84)),
        high: hslToHex(hue + range(140, 220), range(0.3, 0.55), range(0.3, 0.45)),
        air: hslToHex(hue + range(-20, 20), 0.8, 0.78),
      },
    });
  }

  const molten = roll > 0.9;
  return createSettings({
    preset: null, type: 'rock', seed: cleanSeed,
    sea: molten ? range(0.3, 0.5) : range(0.08, 0.86),
    relief: range(0.35, 0.95),
    clouds: molten ? range(0, 0.12) : range(0.05, 0.7),
    atmosphere: range(0.25, 0.75),
    ice: molten ? 0 : range(0, 1),
    rings: random() < 0.18 ? range(0.3, 0.8) : 0,
    light: range(-75, 75),
    spin: range(0.15, 0.5),
    emissive: molten ? 1 : 0,
    colors: molten
      ? {
        ocean: hslToHex(range(8, 34), 1, range(0.5, 0.56)),
        low: hslToHex(hue, 0.15, 0.14),
        high: hslToHex(hue, 0.18, 0.3),
        air: hslToHex(range(10, 30), 1, 0.62),
      }
      : {
        ocean: hslToHex(hue, range(0.55, 0.85), range(0.22, 0.32)),
        low: hslToHex(hue + range(70, 170), range(0.3, 0.55), range(0.32, 0.48)),
        high: hslToHex(hue + range(180, 250), range(0.2, 0.4), range(0.38, 0.6)),
        air: hslToHex(hue + range(-20, 30), 0.9, 0.74),
      },
  });
}

const ONSETS = ['v', 'k', 'th', 'm', 'z', 's', 'r', 'n', 'l', 'd', 'x', 'h', 't', 'br', 'cal', 'el', 'or', 'ys'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ae', 'ia', 'ou', 'y'];
const CODAS = ['', 'n', 'r', 's', 'th', 'x', 'l', 'm'];
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export function classify(settings) {
  if (settings.type === 'gas') return 'Gas giant';
  if (settings.emissive > 0.5) return 'Lava world';
  if (settings.ice > 0.8) return 'Ice world';
  if (settings.sea > 0.75) return 'Ocean world';
  if (settings.sea < 0.2) return 'Desert world';
  return 'Terrestrial world';
}

export function describe(settings) {
  const preset = PRESETS[settings.preset];
  const random = createRandom(`${settings.seed}/survey`);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const syllables = 2 + Math.floor(random() * 2);
  let word = '';
  for (let i = 0; i < syllables; i += 1) word += pick(ONSETS) + pick(VOWELS);
  word += pick(CODAS);
  const generated = `${word[0].toUpperCase()}${word.slice(1)} ${pick(NUMERALS)}`;
  const gas = settings.type === 'gas';
  const radius = gas ? 3.6 + random() * 8 : 0.4 + random() * 1.7;
  const moons = Math.floor(random() * (gas ? 60 : 4));
  const dayHours = (gas ? 9 : 14) / (0.18 + settings.spin) * (0.8 + random() * 0.4);
  const klass = classify(settings);
  let temperature = 15 + (settings.sea - 0.5) * 20 - settings.ice * 70 + (0.5 - settings.atmosphere) * -30;
  if (gas) temperature = -180 + random() * 90;
  if (settings.emissive > 0.5) temperature = 700 + random() * 900;

  return {
    name: preset && preset.seed === settings.seed ? preset.name : generated,
    catalog: `EX-${xmur3(settings.seed)().toString(16).toUpperCase().padStart(8, '0').slice(0, 6)}`,
    klass,
    radius: `${radius.toFixed(2)} R⊕`,
    day: `${dayHours.toFixed(1)} h`,
    temperature: `${Math.round(temperature)} °C`,
    moons: String(moons),
  };
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function encodeSettings(settings) {
  const payload = {
    v: VERSION,
    p: settings.preset,
    t: settings.type,
    s: settings.seed,
    e: settings.emissive,
    n: Object.keys(SLIDERS).map((key) => settings[key]),
    c: COLOR_KEYS.map((key) => settings.colors[key]),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSettings(hash) {
  const match = /(?:^|[#&])world=([A-Za-z0-9_-]{8,2000})/.exec(String(hash ?? ''));
  if (!match) return null;
  try {
    const payload = JSON.parse(fromBase64Url(match[1]));
    if (!payload || payload.v !== VERSION || !Array.isArray(payload.n) || !Array.isArray(payload.c)) return null;
    const input = {
      preset: typeof payload.p === 'string' && PRESETS[payload.p] ? payload.p : null,
      type: payload.t,
      seed: payload.s,
      emissive: Number(payload.e),
      colors: {},
    };
    Object.keys(SLIDERS).forEach((key, index) => { input[key] = Number(payload.n[index]); });
    COLOR_KEYS.forEach((key, index) => { input.colors[key] = payload.c[index]; });
    return createSettings(input);
  } catch {
    return null;
  }
}
