'use strict';

// Deck lint for Gaggle. Run with: node --test test/decks.test.js
// Zero dependencies: node:test + node:assert + node:fs only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'decks');
const NOUN_DIR = path.join(ROOT, 'nouns');
const SCENARIO_DIR = path.join(ROOT, 'scenarios');

const MAX_LEN = 32; // fits a phone-width card

// Suspicious plural endings produced by naively appending "s".
const BAD_PLURAL = /(?<![aeiou])ys$|[^s]ss$|chs$|shs$|xs$|fs$|[^aeiou]os$/i;

// Legitimate words that trip BAD_PLURAL.
const PLURAL_ALLOWLIST = [
  'Chefs',
  'Hippos',
  'Rhinos',
  'Flamingos',
  'Avocados',
  'Nachos',
  'Tacos',
  'Burritos',
  'Espressos',
  'Garbos',
  'Physios'
];

// Every scenario must open with one of these words.
const SCENARIO_OPENERS = [
  'At', 'In', 'On', 'During', 'Doing', 'Making', 'Around', 'Under', 'Inside',
  'Behind', 'Aboard', 'Trapped', 'Stuck', 'Stranded', 'Locked', 'Auditioning'
];

function listJson(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => path.join(dir, f));
}

function load(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const nounFiles = listJson(NOUN_DIR);
const scenarioFiles = listJson(SCENARIO_DIR);
const allFiles = [...nounFiles, ...scenarioFiles];

test('deck directories contain deck files', () => {
  assert.ok(nounFiles.length > 0, 'no noun decks found');
  assert.ok(scenarioFiles.length > 0, 'no scenario decks found');
});

for (const file of allFiles) {
  const name = path.relative(ROOT, file);

  test(`${name}: parses to a non-empty array of clean strings`, () => {
    const deck = load(file);
    assert.ok(Array.isArray(deck), 'deck is not an array');
    assert.ok(deck.length > 0, 'deck is empty');
    for (const card of deck) {
      assert.equal(typeof card, 'string', `non-string card: ${JSON.stringify(card)}`);
      assert.ok(card.trim().length > 0, 'empty card');
      assert.equal(card, card.trim(), `leading/trailing whitespace: ${JSON.stringify(card)}`);
      assert.ok(!/\s{2,}/.test(card), `double space inside: ${JSON.stringify(card)}`);
      assert.ok(card.length <= MAX_LEN, `too long (${card.length} > ${MAX_LEN}): ${card}`);
      assert.ok(!/'S\b/.test(card), `capital S after apostrophe: ${card}`);
      assert.ok(/^[A-Z0-9]/.test(card), `must start with a capital or digit: ${card}`);
    }
  });

  test(`${name}: no duplicates within the file (case-insensitive)`, () => {
    const seen = new Map();
    for (const card of load(file)) {
      const key = card.toLowerCase();
      assert.ok(!seen.has(key), `duplicate: "${card}" and "${seen.get(key)}"`);
      seen.set(key, card);
    }
  });
}

test('no duplicates across noun decks (case-insensitive)', () => {
  const seen = new Map();
  for (const file of nounFiles) {
    const name = path.basename(file);
    for (const card of load(file)) {
      const key = card.toLowerCase();
      assert.ok(!seen.has(key), `"${card}" in ${name} also in ${seen.get(key)}`);
      seen.set(key, name);
    }
  }
});

test('noun plurals look right', () => {
  const allow = new Set(PLURAL_ALLOWLIST.map(w => w.toLowerCase()));
  const bad = [];
  for (const file of nounFiles) {
    for (const card of load(file)) {
      if (allow.has(card.toLowerCase())) continue;
      if (BAD_PLURAL.test(card)) bad.push(`${path.basename(file)}: ${card}`);
    }
  }
  assert.deepEqual(bad, [], 'suspicious plurals (add to PLURAL_ALLOWLIST if legitimate)');
});

test('plural allowlist only contains words that are actually in a deck', () => {
  const present = new Set();
  for (const file of nounFiles) for (const card of load(file)) present.add(card.toLowerCase());
  const stale = PLURAL_ALLOWLIST.filter(w => !present.has(w.toLowerCase()));
  assert.deepEqual(stale, [], 'stale allowlist entries');
});

test('scenarios start with a capitalised preposition or verb', () => {
  const bad = [];
  for (const file of scenarioFiles) {
    for (const card of load(file)) {
      const first = card.split(/\s+/)[0];
      if (!SCENARIO_OPENERS.includes(first)) bad.push(`${path.basename(file)}: ${card}`);
    }
  }
  assert.deepEqual(bad, [], 'unexpected scenario opener');
});

test('scenarios use "an" before a vowel sound', () => {
  const bad = [];
  for (const file of scenarioFiles) {
    for (const card of load(file)) {
      if (/\ba [AEIOU]/.test(card) || /\ban [^AEIOUaeiou]/.test(card)) {
        bad.push(`${path.basename(file)}: ${card}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'a/an mismatch');
});

test('print deck sizes', () => {
  for (const file of allFiles) {
    console.log(`  ${path.relative(ROOT, file)}: ${load(file).length} cards`);
  }
});
