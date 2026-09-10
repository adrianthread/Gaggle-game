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

const NOUN_DECKS = ['animals', 'food-and-bev', 'mythical', 'professions', 'sporting-athletes'];
const tiers = read('decks/difficulty.json');
const nouns = NOUN_DECKS.flatMap((d) => read(`decks/nouns/${d}.json`));
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

test('deck sizes and tier split', () => {
  for (const [kind, deck] of KINDS) {
    const e = tiers[kind].easy.length;
    const h = tiers[kind].hard.length;
    console.log(`  ${kind}: ${deck.length} cards — ${e} easy / ${deck.length - e - h} medium / ${h} hard`);
  }
});
