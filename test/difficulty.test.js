'use strict';
// decks/difficulty.json tags cards as easy or hard (anything unlisted is medium).
// The names are duplicated from the deck files, so the main job here is catching drift:
// a card renamed or removed in a deck must not leave a stale tier entry behind.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

// Deck ORDER is load-bearing: the daily seed indexes into the combined noun list, so a
// different order means a different card for the same day. Take it from the app, never
// hardcode it here.
const { NOUN_DECKS, pickDaily, dailyTier, tierPool, mulberry32 } = require('../script.js');
const tiers = read('decks/difficulty.json');
const nouns = NOUN_DECKS.flatMap((d) => read(`decks/nouns/${d.key}.json`));
const scenarios = read('decks/scenarios/physical-settings.json');
const KINDS = [['nouns', nouns], ['scenarios', scenarios]];

test('difficulty.json has the expected shape', () => {
  assert.deepEqual(Object.keys(tiers).sort(), ['nouns', 'scenarios']);
  for (const [kind] of KINDS) {
    assert.deepEqual(Object.keys(tiers[kind]).sort(), ['easy', 'hard'], `${kind} has exactly easy+hard`);
    for (const tier of ['easy', 'hard']) {
      const list = tiers[kind][tier];
      assert.ok(Array.isArray(list) && list.length, `${kind}.${tier} is a non-empty array`);
      assert.ok(list.every((s) => typeof s === 'string' && s === s.trim() && s), `${kind}.${tier} holds trimmed strings`);
    }
  }
});

test('every tiered name exists byte-identically in a deck', () => {
  for (const [kind, deck] of KINDS) {
    const known = new Set(deck);
    for (const tier of ['easy', 'hard']) {
      const stale = tiers[kind][tier].filter((n) => !known.has(n));
      assert.deepEqual(stale, [], `${kind}.${tier} names missing from the decks (renamed or removed?)`);
    }
  }
});

test('no card is both easy and hard, and none is listed twice', () => {
  for (const [kind] of KINDS) {
    for (const tier of ['easy', 'hard']) {
      const list = tiers[kind][tier];
      assert.equal(new Set(list).size, list.length, `${kind}.${tier} has no duplicates`);
    }
    const easy = new Set(tiers[kind].easy);
    const both = tiers[kind].hard.filter((n) => easy.has(n));
    assert.deepEqual(both, [], `${kind} cards in both tiers`);
  }
});

test('each tier is big enough that a locked difficulty does not repeat itself', () => {
  // drawPool() widens back to the full deck below 5, which would silently defeat the setting.
  const floors = { nouns: 40, scenarios: 25 };
  for (const [kind, deck] of KINDS) {
    for (const tier of ['easy', 'hard']) {
      assert.ok(tiers[kind][tier].length >= floors[kind],
        `${kind}.${tier} has ${tiers[kind][tier].length}, want >= ${floors[kind]}`);
    }
    const tagged = tiers[kind].easy.length + tiers[kind].hard.length;
    assert.ok(deck.length - tagged >= floors[kind], `${kind} has enough medium cards left (${deck.length - tagged})`);
  }
});

// The daily draws from a tier rolled off the date, so it is the same for everyone but
// still mostly gentle. These use the real deck + tier data, not fixtures.
const tierSets = {
  nouns: { easy: new Set(tiers.nouns.easy), hard: new Set(tiers.nouns.hard) },
  scenarios: { easy: new Set(tiers.scenarios.easy), hard: new Set(tiers.scenarios.hard) },
};

test('daily mixes tiers at roughly 70/20/10, and each pair really is from its tier', () => {
  const counts = { easy: 0, medium: 0, hard: 0 };
  const N = 3000;
  for (let day = 0; day < N; day++) {
    const [noun, scn] = pickDaily(day, nouns, scenarios, tierSets);
    const tier = dailyTier(mulberry32(day)());
    counts[tier] += 1;
    assert.ok(tierPool(nouns, tier, tierSets.nouns).includes(noun), `day ${day}: "${noun}" is not a ${tier} noun`);
    assert.ok(tierPool(scenarios, tier, tierSets.scenarios).includes(scn), `day ${day}: "${scn}" is not a ${tier} scenario`);
  }
  const pct = (k) => (counts[k] / N) * 100;
  console.log(`  daily mix over ${N} days: ${pct('easy').toFixed(1)}% easy / ${pct('medium').toFixed(1)}% medium / ${pct('hard').toFixed(1)}% hard`);
  for (const [tier, want] of [['easy', 70], ['medium', 20], ['hard', 10]]) {
    assert.ok(Math.abs(pct(tier) - want) < 4, `${tier} should be ~${want}%, got ${pct(tier).toFixed(1)}%`);
  }
});

test('daily is deterministic, and survives difficulty.json going missing', () => {
  assert.deepEqual(pickDaily(616, nouns, scenarios, tierSets), pickDaily(616, nouns, scenarios, tierSets));
  // no tiers at all -> uniform draw rather than an empty pool
  const bare = pickDaily(616, nouns, scenarios, null);
  assert.equal(bare.length, 2);
  assert.ok(nouns.includes(bare[0]) && scenarios.includes(bare[1]));
  // empty tier lists -> same graceful fallback
  const empty = { nouns: { easy: new Set(), hard: new Set() }, scenarios: { easy: new Set(), hard: new Set() } };
  const e = pickDaily(616, nouns, scenarios, empty);
  assert.ok(nouns.includes(e[0]) && scenarios.includes(e[1]));
});

test('consecutive days vary: no long runs of the same card', () => {
  const seen = [];
  for (let day = 600; day < 660; day++) seen.push(pickDaily(day, nouns, scenarios, tierSets).join(' · '));
  assert.equal(new Set(seen).size, seen.length, 'sixty consecutive dailies are all distinct pairs');
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], `day ${600 + i} repeats the day before`);
});

test('deck sizes and tier split', () => {
  for (const [kind, deck] of KINDS) {
    const e = tiers[kind].easy.length;
    const h = tiers[kind].hard.length;
    console.log(`  ${kind}: ${deck.length} cards — ${e} easy / ${deck.length - e - h} medium / ${h} hard`);
  }
});
