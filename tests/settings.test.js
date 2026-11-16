import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, classify, createRandom, createSettings, decodeSettings, describe, discover, encodeSettings, normalizeSeed, seedOffset,
} from '../src/settings.js';

test('seeds are normalized and never empty', () => {
  assert.equal(normalizeSeed('  Hello World!! '), 'helloworld');
  assert.equal(normalizeSeed(''), 'exosphere');
  assert.equal(normalizeSeed('x'.repeat(80)).length, 32);
});

test('the seeded generator is deterministic and stays in range', () => {
  const a = createRandom('kepler');
  const b = createRandom('kepler');
  for (let i = 0; i < 200; i += 1) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
  assert.notDeepEqual(seedOffset('kepler'), seedOffset('kepler-2'));
});

test('settings clamp hostile values and fall back to the preset', () => {
  const settings = createSettings({ preset: 'cinder', sea: 99, relief: -4, light: Number.NaN, colors: { ocean: 'red', air: '#ABCDEF' } });
  assert.equal(settings.sea, 1);
  assert.equal(settings.relief, 0);
  assert.equal(settings.light, PRESETS.cinder.light);
  assert.equal(settings.colors.ocean, PRESETS.cinder.colors.ocean);
  assert.equal(settings.colors.air, '#abcdef');
  assert.equal(createSettings({ preset: 'nope' }).preset, 'tellus');
});

test('share links round-trip every preset and reject garbage', () => {
  for (const id of Object.keys(PRESETS)) {
    const settings = createSettings({ preset: id });
    assert.deepEqual(decodeSettings(`#world=${encodeSettings(settings)}`), settings);
  }
  assert.equal(decodeSettings('#world=not-a-real-payload'), null);
  assert.equal(decodeSettings('#other=1'), null);
  assert.equal(decodeSettings(`#world=${btoa(JSON.stringify({ v: 99, n: [], c: [] }))}`), null);
});

test('discovery is reproducible from the seed alone', () => {
  assert.deepEqual(discover('abc-123'), discover('abc-123'));
  const kinds = new Set();
  for (let i = 0; i < 300; i += 1) kinds.add(classify(discover(`survey-${i}`)));
  assert.ok(kinds.has('Gas giant'));
  assert.ok(kinds.has('Lava world'));
  assert.ok(kinds.size >= 5);
});

test('survey cards name catalogued worlds and generate the rest', () => {
  assert.equal(describe(createSettings({ preset: 'aurelia' })).name, 'Aurelia');
  const card = describe(discover('abc-123'));
  assert.match(card.name, /^[A-Z][a-z]+ [IVX]+$/);
  assert.match(card.catalog, /^EX-[0-9A-F]{6}$/);
  assert.deepEqual(card, describe(discover('abc-123')));
});
