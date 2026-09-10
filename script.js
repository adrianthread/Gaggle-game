'use strict';
/* =====================================================================
   Gaggle v2 — script.js
   Section 1: pure helpers (no DOM; exported for `node` tests at the end)
   Section 2: the app — a small state machine + render()
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. PURE HELPERS
   ------------------------------------------------------------------ */

const EPOCH_UTC = Date.UTC(2025, 0, 1);
const DAY_MS = 86400000;
const JUDGE_URL = '/api/judge';
const GOOSE_NAME = 'The Goose';
const PARTY_ROUNDS = 3;
const FREE_TARGET = 3;
const FREE_MAX = 5;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

// File order matters: the daily seed indexes the COMBINED list in this order.
const NOUN_DECKS = [
  { key: 'animals', label: 'Animals', path: '/decks/nouns/animals.json' },
  { key: 'food-and-bev', label: 'Food & Drink', path: '/decks/nouns/food-and-bev.json' },
  { key: 'professions', label: 'Jobs', path: '/decks/nouns/professions.json' },
  { key: 'sporting-athletes', label: 'Sport', path: '/decks/nouns/sporting-athletes.json' },
  { key: 'mythical', label: 'Mythical', path: '/decks/nouns/mythical.json' },
];
const SCENARIO_PATH = '/decks/scenarios/physical-settings.json';
const DIFFICULTY_PATH = '/decks/difficulty.json';
const DIFFICULTIES = ['easy', 'mixed', 'hard'];

const STORAGE = {
  daily: 'gaggle.daily',
  players: 'gaggle.players',
  name: 'gaggle.name',
  stats: 'gaggle.stats',
  decks: 'gaggle.decks',
  spicy: 'gaggle.spicy',
  difficulty: 'gaggle.difficulty',
};

const HITS = [
  { key: 'pun', emoji: '🎯', label: 'Pun' },
  { key: 'sound', emoji: '👂', label: 'Sounds right' },
  { key: 'scenario', emoji: '🎬', label: 'Fits the scene' },
  { key: 'image', emoji: '🖼️', label: 'Paints a picture' },
];

const BADGES = {
  groaner: { emoji: '🙄', label: 'Groaner' },
  wordsmith: { emoji: '✒️', label: 'Wordsmith' },
  poet: { emoji: '🌹', label: 'Poet' },
  chaos: { emoji: '🌪️', label: 'Chaos agent' },
  wholesome: { emoji: '🧸', label: 'Wholesome' },
  lazy: { emoji: '🦥', label: 'Lazy' },
  filthy: { emoji: '🫣', label: 'Filthy' },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayIndexFor(date) {
  const d = date || new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH_UTC) / DAY_MS);
}

// decksByKey: { animals: [...], 'food-and-bev': [...], ... } → deduped, file order
function combinedNouns(decksByKey) {
  const seen = new Set();
  const out = [];
  for (const deck of NOUN_DECKS) {
    for (const noun of decksByKey[deck.key] || []) {
      if (!seen.has(noun)) { seen.add(noun); out.push(noun); }
    }
  }
  return out;
}

// The daily pair must be identical for everyone, so its difficulty can't come from a local
// setting. The date rolls it instead: 70% easy, 20% medium, 10% hard.
const DAILY_MIX = [['easy', 0.7], ['medium', 0.9], ['hard', 1]];

function dailyTier(roll) {
  for (const [tier, ceiling] of DAILY_MIX) if (roll < ceiling) return tier;
  return 'hard';
}

// Subset of `all` in the given tier; 'medium' means listed in neither easy nor hard.
// Falls back to the whole list when tiers are unavailable, so a missing difficulty.json
// degrades to a uniform draw rather than an empty one.
function tierPool(all, tier, lists) {
  if (!tier || !lists) return all;
  const pool = tier === 'medium'
    ? all.filter((n) => !matchesTier(n, 'easy', lists) && !matchesTier(n, 'hard', lists))
    : all.filter((n) => matchesTier(n, tier, lists));
  return pool.length ? pool : all;
}

function pickDaily(dayIndex, nouns, scenarios, tiers) {
  const rng = mulberry32(dayIndex);
  const tier = dailyTier(rng());
  const nounPool = tierPool(nouns, tier, tiers && tiers.nouns);
  const scnPool = tierPool(scenarios, tier, tiers && tiers.scenarios);
  const noun = nounPool[Math.floor(rng() * nounPool.length)];
  const scenario = scnPool[Math.floor(rng() * scnPool.length)];
  return [noun, scenario];
}

function msUntilMidnight(now) {
  const n = now || new Date();
  const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - n.getTime();
}

function formatCountdown(ms) {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function clampScore(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 1;
  return Math.min(10, Math.max(1, v));
}

function bandFor(score) {
  if (score >= 9) return 'gold';
  if (score >= 7) return 'pink';
  if (score >= 4) return 'amber';
  return 'low';
}

function bandHeadline(score) {
  if (score >= 10) return 'Honk Of The Century';
  if (score >= 9) return 'Golden Goose';
  if (score >= 7) return 'Top Of The Flock';
  if (score >= 5) return 'Decent Waddle';
  if (score >= 3) return 'Ruffled Feathers';
  return 'Cooked Goose';
}

function badgeInfo(badge) {
  if (badge && BADGES[badge]) return BADGES[badge];
  if (badge && typeof badge === 'string') {
    return { emoji: '🪿', label: badge.charAt(0).toUpperCase() + badge.slice(1) };
  }
  return { emoji: '🪿', label: 'Judged' };
}

function outcomeOf(score, botScore) {
  if (score > botScore) return 'win';
  if (score < botScore) return 'lose';
  return 'draw';
}

// The Goose is your RIVAL, so its mood runs inverse to your score: thrash it and it
// deflates, beat it by a hair and it sulks, win and it gloats.
function moodFor(score, botScore) {
  const o = outcomeOf(score, botScore);
  const diff = Math.abs(score - botScore);
  if (o === 'win') return diff >= 3 ? 'deflated' : 'ruffled';
  if (o === 'lose') return score <= 2 ? 'derisive' : (diff >= 3 ? 'triumphant' : 'smug');
  return 'unimpressed';
}

function scoreBar(score, filled, empty) {
  const s = clampScore(score);
  return (filled || '🟩').repeat(s) + (empty || '⬜').repeat(10 - s);
}

function cardsTitle(cards) {
  return `${cards[0]} · ${cards[1]}`;
}

function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}th`;
}

function gooseLine(score, botScore) {
  const o = outcomeOf(score, botScore);
  if (o === 'win') return `🥊 Beat the Goose (${botScore}/10)`;
  if (o === 'lose') return `🪿 Lost to the Goose (${botScore}/10)`;
  return `🤝 Drew with the Goose (${botScore}/10)`;
}

// Daily: cards shown, answer hidden, 🟩 bar, goose score, streak, URL last.
function dailyShareText(o) {
  const streak = o.streak > 1 ? ` · 🔥 ${o.streak}-day streak` : '';
  return [
    `🪿 Gaggle #${o.dayIndex} — ${cardsTitle(o.cards)}`,
    `${scoreBar(o.score)} ${o.score}/10 · ${o.verdict}`,
    `${gooseLine(o.score, o.botScore)}${streak}`,
    'Can you do better?',
    o.url,
  ].join('\n');
}

// Free play, one round.
function roundShareText(o) {
  return [
    `🪿 Gaggle — ${cardsTitle(o.cards)}`,
    `Me: ${o.score}/10 ${scoreBar(o.score)}`,
    `"${o.answer}"`,
    `Goose: ${o.botScore}/10 ${scoreBar(o.botScore, '🟨')}`,
    'Can you beat me?',
    o.url,
  ].join('\n');
}

// Free play, end of match.
function matchShareText(o) {
  const head = o.you > o.goose
    ? `I beat the Goose ${o.you}–${o.goose}`
    : o.you < o.goose
      ? `The Goose beat me ${o.goose}–${o.you}`
      : `Drew with the Goose ${o.you}–${o.goose}`;
  const lines = [`🪿 Gaggle — ${head} (best of 5)`];
  if (o.best) lines.push(`Best line: "${o.best.answer}" ${o.best.score}/10 (${cardsTitle(o.best.cards)})`);
  lines.push('Can you beat the Goose?', o.url);
  return lines.join('\n');
}

// Party, one round: everyone ranked, Goose included at its rank.
function partyRoundShareText(o) {
  const lines = [`🪿 Gaggle — ${cardsTitle(o.cards)}`];
  o.entries.forEach((e, i) => {
    const who = e.goose ? '🪿 The Goose' : e.name;
    lines.push(`${medal(i + 1)} ${who} ${e.score}/10 "${e.answer}"`);
  });
  lines.push(o.url);
  return lines.join('\n');
}

// Party, after 3 rounds.
function partyShareText(o) {
  const lines = [`🪿 Gaggle Party — ${o.rounds} rounds`];
  o.totals.forEach((t, i) => {
    const who = t.goose ? '🪿 The Goose' : t.name;
    lines.push(`${medal(i + 1)} ${who} ${t.total}`);
  });
  if (o.best) lines.push(`Best line: "${o.best.answer}" — ${o.best.name} (${o.best.score}/10)`);
  lines.push(o.url);
  return lines.join('\n');
}

// results (players) + bot → one ranked list, highest first, Goose inserted.
function rankEntries(results, bot) {
  const entries = (results || []).map((r) => ({
    name: r.name,
    answer: r.answer || '',
    score: clampScore(r.score),
    verdict: r.verdict || bandHeadline(clampScore(r.score)),
    comment: r.comment || '',
    hits: Array.isArray(r.hits) ? r.hits : [],
    badge: r.badge || '',
    goose: false,
  }));
  if (bot && bot.answer) {
    entries.push({
      name: GOOSE_NAME, answer: bot.answer, score: clampScore(bot.score),
      verdict: bandHeadline(clampScore(bot.score)), comment: '', hits: [], badge: '', goose: true,
    });
  }
  // Stable sort: higher score first; players before the Goose on ties.
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.score - a.e.score) || (a.e.goose - b.e.goose) || (a.i - b.i))
    .map((x) => x.e);
}

function rankTotals(totals) {
  return Object.keys(totals)
    .map((name) => ({ name, total: totals[name], goose: name === GOOSE_NAME }))
    .sort((a, b) => (b.total - a.total) || (a.goose - b.goose) || a.name.localeCompare(b.name));
}

function dedupeNames(names) {
  // Reserve the judge's own name: a player called "The Goose" would otherwise share
  // the Goose's tally row and be ranked as the bot.
  const seen = new Map([[GOOSE_NAME.toLowerCase(), 1]]);
  return names
    .map((n) => String(n || '').trim().slice(0, 24))
    .filter(Boolean)
    .map((n) => {
      const k = n.toLowerCase();
      const c = (seen.get(k) || 0) + 1;
      seen.set(k, c);
      return c === 1 ? n : `${n} (${c})`;
    });
}

// Cards not listed in difficulty.json are "medium" and only ever appear in a mixed draw.
// `tier` of null means "anything goes".
function matchesTier(name, tier, tiers) {
  if (!tier) return true;
  const list = tiers && tiers[tier];
  if (!list) return false;
  return typeof list.has === 'function' ? list.has(name) : list.indexOf(name) !== -1;
}

// A locked difficulty is honoured every round. "Mixed" ramps instead: round one is always
// a gimme so you're laughing before you're thinking, and the last round bares its teeth.
function tierForRound(difficulty, mode, round) {
  if (difficulty === 'easy') return 'easy';
  if (difficulty === 'hard') return 'hard';
  if (mode === 'free') return round <= 2 ? 'easy' : (round >= FREE_MAX ? 'hard' : null);
  if (mode === 'party') return round <= 1 ? 'easy' : (round >= PARTY_ROUNDS ? 'hard' : null);
  return null;
}

function diffHintText(difficulty) {
  if (difficulty === 'easy') return 'Cards that hand you the joke. Good for warming up.';
  if (difficulty === 'hard') return 'Awkward pairings that give you nothing. Earn it.';
  return 'Round one eases you in; the last round bites. The daily is the same for everyone either way.';
}

function answerPlaceholder(noun) {
  return `a ___ of ${String(noun || '').toLowerCase()}`;
}

function nextFreeRound(free, outcome) {
  const f = { ...free, rounds: free.rounds.slice() };
  if (outcome === 'win') f.you += 1;
  else if (outcome === 'lose') f.goose += 1;
  else f.draws += 1;
  f.over = f.you >= FREE_TARGET || f.goose >= FREE_TARGET || f.round >= FREE_MAX;
  if (!f.over) f.round += 1;
  return f;
}

/* ---------------------------------------------------------------------
   2. THE APP
   ------------------------------------------------------------------ */

function startApp() {
  const $ = (id) => document.getElementById(id);
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shareUrl = (hash) => `${location.origin}${location.pathname}${hash || ''}`;

  /* ---- the goose avatar ---- */
  // One <template> in the markup, cloned into each host. Mood is a data attribute;
  // all the posing is CSS, so changing it animates for free.
  const geese = new Map();
  function mountGoose(id, mood) {
    if (geese.has(id)) return geese.get(id);
    const host = $(id);
    const tpl = $('gooseTemplate');
    if (!host || !tpl || !tpl.content || !tpl.content.firstElementChild) return null;
    const svg = tpl.content.firstElementChild.cloneNode(true);
    svg.setAttribute('data-mood', mood || 'idle');
    host.replaceChildren(svg);
    geese.set(id, svg);
    return svg;
  }
  function setMood(id, mood) {
    const svg = geese.get(id) || mountGoose(id, mood);
    if (svg) svg.setAttribute('data-mood', mood);
  }

  /* ---- storage ---- */
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
  }
  // Shape-checked reads: a hand-edited or stale value ("5", "\"x\"", "[1,2]") must never throw
  // (strict mode makes `"x".wins = 1` a TypeError) — treat anything of the wrong shape as absent.
  function loadObj(key) {
    const v = load(key, null);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  }
  function loadArr(key) {
    const v = load(key, null);
    return Array.isArray(v) ? v : [];
  }

  /* ---- settings ---- */
  const settings = {
    decks: (() => {
      const stored = load(STORAGE.decks, null);
      const valid = NOUN_DECKS.map((d) => d.key);
      const list = Array.isArray(stored) ? stored.filter((k) => valid.includes(k)) : valid;
      return list.length ? list : valid;
    })(),
    spicy: load(STORAGE.spicy, false) === true,
    difficulty: (() => { const d = load(STORAGE.difficulty, 'mixed'); return DIFFICULTIES.includes(d) ? d : 'mixed'; })(),
    name: (() => { const n = load(STORAGE.name, ''); return typeof n === 'string' ? n.slice(0, 24) : ''; })(),
  };
  const playerName = () => settings.name.trim() || 'You';

  /* ---- decks ---- */
  const decks = {
    nouns: {}, scenarios: [], loaded: false, failed: false,
    tiers: { nouns: { easy: new Set(), hard: new Set() }, scenarios: { easy: new Set(), hard: new Set() } },
  };

  async function fetchDeck(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error(`${path}: not an array`);
    return data.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  }

  async function loadDecks() {
    try {
      const results = await Promise.all([
        ...NOUN_DECKS.map((d) => fetchDeck(d.path).catch((e) => { console.warn(e); return []; })),
        fetchDeck(SCENARIO_PATH),
      ]);
      NOUN_DECKS.forEach((d, i) => { decks.nouns[d.key] = results[i]; });
      decks.scenarios = results[NOUN_DECKS.length];
      const total = combinedNouns(decks.nouns).length;
      if (!total || !decks.scenarios.length) throw new Error('empty decks');
      decks.loaded = true;
      // Difficulty tiers are a bonus, not a dependency: if this file is missing or malformed
      // every card stays "medium" and the draw quietly falls back to the whole deck.
      try {
        const r = await fetch(DIFFICULTY_PATH);
        if (r.ok) {
          const t = await r.json();
          for (const kind of ['nouns', 'scenarios']) {
            for (const tier of ['easy', 'hard']) {
              const list = t && t[kind] && t[kind][tier];
              if (Array.isArray(list)) decks.tiers[kind][tier] = new Set(list.filter((s) => typeof s === 'string'));
            }
          }
        }
      } catch (e) { console.warn('difficulty tiers unavailable', e); }
    } catch (e) {
      console.error(e);
      decks.failed = true;
      toast("🪿 Couldn't load the decks — refresh to try again", 4000);
    }
    render();
    if (decks.loaded && state.screen === 'game' && state.mode === 'daily' && state.phase === 'draw') drawCards();
    // Deep-linked "already played" renders before decks arrive with a generic "Noun" tag; re-tag now.
    if (decks.loaded && state.phase === 'dailyDone' && state.cards) {
      state.tags = [deckLabelOf(state.cards[0]), 'Scenario'];
      renderCards(state.cards, state.tags, true);
    }
  }

  const MIN_POOL = 5; // below this a tier repeats itself, so widen instead

  function drawPool(tier) {
    let keys = NOUN_DECKS.filter((d) => settings.decks.includes(d.key)).map((d) => d.key);
    if (!keys.some((k) => (decks.nouns[k] || []).length)) keys = NOUN_DECKS.map((d) => d.key);
    const pool = [];
    for (const d of NOUN_DECKS) {
      if (!keys.includes(d.key)) continue;
      for (const noun of decks.nouns[d.key] || []) {
        if (matchesTier(noun, tier, decks.tiers.nouns)) pool.push({ noun, label: d.label });
      }
    }
    // A tier can come up short when few decks are enabled; never strand the player.
    return pool.length >= MIN_POOL ? pool : (tier ? drawPool(null) : pool);
  }

  function scenarioPool(tier) {
    const pool = decks.scenarios.filter((s) => matchesTier(s, tier, decks.tiers.scenarios));
    return pool.length >= MIN_POOL ? pool : decks.scenarios;
  }

  function deckLabelOf(noun) {
    const d = NOUN_DECKS.find((x) => (decks.nouns[x.key] || []).includes(noun));
    return d ? d.label : 'Noun';
  }

  /* ---- state ---- */
  const state = {
    screen: 'home',   // home | setup | game | match | champion
    mode: null,       // daily | free | party
    phase: 'draw',    // draw | dealing | answer | curtain | judging | result | podium | dailyDone
    cards: null,
    tags: null,
    players: [],
    answers: [],
    turn: 0,
    round: 1,
    result: null,
    judgeError: false,
    free: null,
    party: null,
    roundId: 0,
    setupNames: [],
    dailyIndex: null, // the Gaggle # the current daily cards belong to (snapshotted at deal time)
  };

  let timers = [];
  function later(fn, ms) {
    const rid = state.roundId;
    const id = setTimeout(() => { if (rid === state.roundId) fn(); }, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function freshFree() { return { you: 0, goose: 0, draws: 0, round: 1, over: false, rounds: [] }; }
  function freshParty(players) {
    const totals = Object.create(null); // names are keys; "__proto__" must not hit the prototype
    players.forEach((p) => { totals[p] = 0; });
    totals[GOOSE_NAME] = 0;
    return { totals, best: null, rounds: [] };
  }

  /* ---- toast & share ---- */
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 300); }, ms || 2200);
  }

  async function share(text) {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ text }))) {
      try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(text); toast('Copied — paste it anywhere 📋'); return; } catch { /* fall through */ }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.readOnly = true; ta.className = 'sr-only';
      document.body.append(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      if (ok) { toast('Copied — paste it anywhere 📋'); return; }
    } catch { /* fall through */ }
    window.prompt('Copy your Gaggle result:', text);
  }

  /* ---- screens / render ---- */
  const SCREENS = ['home', 'setup', 'game', 'match', 'champion'];

  function render() {
    SCREENS.forEach((s) => { $(s).hidden = s !== state.screen; });
    const curtainOn = state.screen === 'game' && state.phase === 'curtain';
    $('curtain').hidden = !curtainOn;
    document.body.classList.toggle('has-curtain', curtainOn);
    // Nothing behind the curtain may be focused or read out while it's up.
    $('app').toggleAttribute('inert', curtainOn);
    $('app').setAttribute('aria-hidden', curtainOn ? 'true' : 'false');
    if (state.screen === 'home') renderHome();
    if (state.screen === 'setup') renderSetupStart();
    if (state.screen === 'game') renderGame();
    if (curtainOn) renderCurtain();
  }

  function renderHome() {
    const today = dayIndexFor();
    const d = loadObj(STORAGE.daily) || {};
    const sub = $('dailySub');
    if (d.lastPlayedDay === today) {
      sub.textContent = `✓ played · next in ${formatCountdown(msUntilMidnight())}`;
    } else {
      const alive = d.lastPlayedDay === today - 1 && d.streak > 0;
      sub.textContent = `#${today}${alive ? ` · 🔥 ${d.streak}` : ''}`;
    }
    const st = loadObj(STORAGE.stats);
    const foot = $('homeStats');
    if (st && (st.wins || st.losses || st.draws)) {
      foot.hidden = false;
      foot.textContent = `vs the Goose: ${st.wins || 0}W · ${st.losses || 0}L · ${st.draws || 0}D · best ${st.best || 0}/10`;
    } else {
      foot.hidden = true;
    }
  }

  function tallyText() {
    if (state.mode === 'daily') return `Gaggle #${state.dailyIndex == null ? dayIndexFor() : state.dailyIndex}`;
    if (state.mode === 'free' && state.free) {
      const f = state.free;
      return `You ${f.you} – 🪿 ${f.goose} · Round ${Math.min(f.round, FREE_MAX)}/${FREE_MAX}`;
    }
    if (state.mode === 'party' && state.party) {
      const top = rankTotals(state.party.totals).slice(0, 3)
        .map((t) => `${t.goose ? '🪿' : t.name} ${t.total}`).join(' · ');
      return `Round ${state.round}/${PARTY_ROUNDS}${state.round > 1 ? ` · ${top}` : ''}`;
    }
    return '';
  }

  function promptHtml() {
    if (!state.cards) return '';
    const [noun, scn] = state.cards;
    const who = state.mode === 'party' && state.players[state.turn]
      ? `<span class="who-turn">${escapeHtml(state.players[state.turn])}</span>, what`
      : 'What';
    return `${who} do you call a group of <b>${escapeHtml(noun)}</b> … <b>${escapeHtml(scn)}</b>?`;
  }

  function renderGame() {
    const p = state.phase;
    const mode = state.mode;
    $('tally').textContent = tallyText();

    $('drawStage').hidden = p !== 'draw';
    const drawBtn = $('drawBtn');
    drawBtn.disabled = !decks.loaded;
    drawBtn.textContent = decks.loaded
      ? (mode === 'daily' ? "Deal today's cards" : (mode === 'party' ? 'Deal the cards' : 'Draw cards'))
      : (decks.failed ? 'Decks missing' : 'Shuffling…');

    const soloJudging = p === 'judging' && mode !== 'party';
    $('answerStage').hidden = !(p === 'answer' || soloJudging);
    $('answerStage').classList.toggle('is-judging', soloJudging);
    $('judgeBox').hidden = !(p === 'judging' && mode === 'party');
    $('retryJudgeBtn').hidden = !state.judgeError;
    $('judgeBoxLine').textContent = state.judgeError
      ? 'The Goose flew off before judging.'
      : `The Goose is judging ${state.answers.length} answers…`;
    $('result').hidden = p !== 'result';
    $('podium').hidden = p !== 'podium';
    $('dailyDone').hidden = p !== 'dailyDone';

    const cardArea = $('cardArea');
    cardArea.classList.toggle('judging', p === 'judging');
    cardArea.classList.toggle('dimmed', p === 'result' || p === 'podium' || p === 'dailyDone');

    if (p === 'answer' || soloJudging) {
      $('promptText').innerHTML = promptHtml();
      const input = $('answerInput');
      input.placeholder = answerPlaceholder(state.cards[0]);
      input.readOnly = soloJudging;
      const judgeBtn = $('judgeBtn');
      judgeBtn.disabled = soloJudging;
      judgeBtn.textContent = soloJudging ? 'Judging…' : (mode === 'party' ? 'Lock in & pass →' : 'Judge it 🪿');
      $('judgingWrap').hidden = !soloJudging;
      $('aimHits').innerHTML = hitsHtml([]); // all four dim: the goals, not a score
      $('drawAgainBtn').hidden = !(mode === 'free' && p === 'answer');
      $('skipBtn').hidden = !(mode === 'party' && p === 'answer');
    }
  }

  function renderCurtain() {
    const name = state.players[state.turn] || '';
    $('curtainName').textContent = name;
    $('curtainCount').textContent = `${state.turn + 1} of ${state.players.length}`;
    $('curtainOkBtn').textContent = `I'm ${name} — ready`;
    $('curtainTally').textContent = tallyText();
    // Move focus onto the curtain so Enter/keyboard users aren't left on a now-inert input.
    try { $('curtainOkBtn').focus({ preventScroll: true }); } catch { /* ignore */ }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---- cards ---- */
  function renderCards(cards, tags, instant) {
    const area = $('cardArea');
    area.innerHTML = '';
    cards.forEach((word, i) => {
      const card = document.createElement('div');
      card.className = `card ${i === 0 ? 'card--noun' : 'card--scn'}`;
      const inner = document.createElement('div');
      inner.className = 'card-inner';
      const front = document.createElement('div');
      front.className = 'card-front';
      front.innerHTML = '<span class="card-goose" aria-hidden="true">🪿</span><span class="card-brand">GAGGLE</span>';
      const back = document.createElement('div');
      back.className = 'card-back';
      const tag = document.createElement('span');
      tag.className = 'card-tag';
      tag.textContent = tags[i];
      const text = document.createElement('span');
      text.className = 'card-word';
      text.textContent = word;
      const rule = document.createElement('span');
      rule.className = 'card-rule';
      rule.setAttribute('aria-hidden', 'true');
      rule.textContent = '· · · · ·';
      back.append(tag, text, rule);
      inner.append(front, back);
      card.append(inner);
      area.append(card);
      if (instant || reducedMotion()) {
        card.classList.add('flipped');
      } else {
        setTimeout(() => card.classList.add('flipped'), 60 + 120 * i);
      }
    });
  }

  function resetRoundUI() {
    clearTimers();
    $('cardArea').innerHTML = '';
    $('answerInput').value = '';
    $('answerError').hidden = true;
    ['resultConfetti', 'podiumConfetti'].forEach((id) => { $(id).innerHTML = ''; });
    ['alsoIn', 'podiumAlsoIn'].forEach((id) => { $(id).hidden = true; });
    ['resultImg', 'podiumImg'].forEach((id) => {
      const fig = $(id);
      fig.hidden = true;
      fig.classList.remove('loaded');
      const img = fig.querySelector('img');
      if (img) img.remove();
    });
    const result = $('result');
    result.classList.remove('sad', 'is-win', 'is-lose', 'is-draw');
    result.removeAttribute('data-band');
    $('rankList').innerHTML = '';
  }

  function newRound() {
    state.roundId += 1;
    state.cards = null;
    state.tags = null;
    state.answers = [];
    state.turn = 0;
    state.result = null;
    state.judgeError = false;
    state.phase = 'draw';
    resetRoundUI();
  }

  function drawCards() {
    if (!decks.loaded || state.phase === 'dealing') return; // double-tap on Draw/Next must not re-deal
    newRound();
    let cards;
    let tags;
    if (state.mode === 'daily') {
      state.dailyIndex = dayIndexFor();
      cards = pickDaily(state.dailyIndex, combinedNouns(decks.nouns), decks.scenarios, decks.tiers);
      tags = [deckLabelOf(cards[0]), 'Scenario'];
    } else {
      // The daily deliberately ignores difficulty above: everyone must get the same pair.
      const round = state.mode === 'free' ? (state.free ? state.free.round : 1) : state.round;
      const tier = tierForRound(settings.difficulty, state.mode, round);
      const pool = drawPool(tier);
      const scns = scenarioPool(tier);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const scn = scns[Math.floor(Math.random() * scns.length)];
      cards = [pick.noun, scn];
      tags = [pick.label, 'Scenario'];
    }
    state.cards = cards;
    state.tags = tags;
    state.phase = 'dealing';
    render();
    renderCards(cards, tags, false);
    later(() => {
      state.phase = state.mode === 'party' ? 'curtain' : 'answer';
      render();
      if (state.phase === 'answer') focusInput();
    }, reducedMotion() ? 80 : 1000);
  }

  function focusInput() {
    const input = $('answerInput');
    try { input.focus({ preventScroll: true }); } catch { input.focus(); }
    input.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  /* ---- judging ---- */
  function judgeErrorMessage(err) {
    if (err && err.name === 'AbortError') return '🪿 The Goose fell asleep (timed out). Try again.';
    const status = err && err.status;
    if (err && err.serverMessage && (status === 400 || status === 413)) return `🪿 ${err.serverMessage}`;
    switch (status) {
      case 400: return '🪿 The Goose rejected that answer. Try another.';
      case 413: return '🪿 Too much to judge — shorten your answer.';
      case 429: return '🪿 The Goose is swamped — try again in a moment.';
      case 500: return '🪿 The Goose has no key. Check the server setup.';
      case 502: return '🪿 The Goose talked gibberish. Try again.';
      case 503: return '🪿 The Goose is overloaded. Try again shortly.';
      case 504: return '🪿 The Goose took too long. Try again.';
      default: return status ? `🪿 The Goose flew off (${status}). Try again.` : '🪿 The Goose flew off. Check your connection.';
    }
  }

  async function fetchJudge(body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 40000);
    try {
      const r = await fetch(JUDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      let data = null;
      try { data = await r.json(); } catch { data = null; }
      if (!r.ok) {
        const e = new Error(`judge ${r.status}`);
        e.status = r.status;
        e.serverMessage = data && typeof data.error === 'string' ? data.error : '';
        throw e;
      }
      if (!data || !Array.isArray(data.results) || data.results.length !== body.answers.length) {
        const e = new Error('bad judge payload');
        e.status = 502;
        throw e;
      }
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  async function judge() {
    if (state.phase === 'judging' || !state.cards) return;
    const rid = state.roundId;
    state.judgeError = false;
    state.phase = 'judging';
    // Reset the bird before the panel appears, so the verdict lands as a reaction.
    setMood('resultGoose', 'deliberating');
    render();
    try {
      const data = await fetchJudge({ cards: state.cards, answers: state.answers, spicy: settings.spicy });
      if (rid !== state.roundId) return;
      state.result = data;
      if (state.mode === 'party') {
        state.phase = 'podium';
        render();
        showPodium(data);
      } else {
        state.phase = 'result';
        render();
        showResult(data);
      }
    } catch (err) {
      if (rid !== state.roundId) return;
      console.warn(err);
      toast(judgeErrorMessage(err), 3500);
      if (state.mode === 'party') {
        state.judgeError = true;
        render();
      } else {
        state.phase = 'answer';
        render();
        focusInput();
      }
    }
  }

  function submitAnswer() {
    if (state.phase !== 'answer' || !state.cards) return;
    const input = $('answerInput');
    const answer = input.value.trim().slice(0, 80);
    if (state.mode === 'party') {
      lockIn(answer);
      return;
    }
    if (!answer) {
      $('answerError').hidden = false;
      input.classList.remove('shake');
      void input.offsetWidth; // restart the animation
      input.classList.add('shake');
      input.focus();
      return;
    }
    $('answerError').hidden = true;
    state.answers = [{ name: playerName(), answer }];
    judge();
  }

  function lockIn(answer) {
    state.answers.push({ name: state.players[state.turn], answer });
    $('answerInput').value = '';
    state.turn += 1;
    if (state.turn < state.players.length) {
      state.phase = 'curtain';
      render();
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      judge();
    }
  }

  /* ---- animations ---- */
  function countUp(el, target, ms) {
    if (reducedMotion()) { el.textContent = String(target); return Promise.resolve(); }
    return new Promise((resolve) => {
      const start = performance.now();
      const dur = ms || 700;
      const rid = state.roundId;
      const tick = (now) => {
        if (rid !== state.roundId) return; // round abandoned mid-count: stop writing stale digits
        const t = Math.min(1, (now - start) / dur);
        const v = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(v * target));
        if (t < 1) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  function setBar(el, score) {
    el.style.setProperty('--pct', '0%');
    requestAnimationFrame(() => requestAnimationFrame(() => el.style.setProperty('--pct', `${score * 10}%`)));
  }

  function confetti(container) {
    if (reducedMotion()) return;
    container.innerHTML = '';
    const colors = ['#ff3d7f', '#ffb703', '#fffaf7', '#ff8fab', '#7c3aed'];
    for (let i = 0; i < 40; i += 1) {
      const p = document.createElement('i');
      p.style.setProperty('--x', `${Math.random() * 100}%`);
      p.style.setProperty('--c', colors[i % colors.length]);
      p.style.setProperty('--d', `${(Math.random() * 0.7).toFixed(2)}s`);
      p.style.setProperty('--r', `${Math.round(Math.random() * 360)}deg`);
      p.style.setProperty('--s', (0.7 + Math.random() * 0.8).toFixed(2));
      container.append(p);
    }
    later(() => { container.innerHTML = ''; }, 2600);
  }

  function hitsHtml(hits) {
    return HITS.map((h) => {
      const lit = hits.includes(h.key);
      return `<span class="pill ${lit ? 'lit' : 'dim'}" title="${h.label}">${h.emoji} ${h.label}</span>`;
    }).join('');
  }

  // Revealed only after the round is decided. Server text, so textContent, never innerHTML.
  function renderAlternatives(boxId, listId, alts) {
    const list = $(listId);
    list.innerHTML = '';
    const clean = (Array.isArray(alts) ? alts : [])
      .filter((a) => typeof a === 'string' && a.trim())
      .slice(0, 2);
    $(boxId).hidden = clean.length === 0;
    for (const a of clean) {
      const li = document.createElement('li');
      li.textContent = a;
      list.append(li);
    }
  }

  function loadImage(fig, url) {
    const rid = state.roundId;
    fig.classList.remove('loaded');
    const old = fig.querySelector('img');
    if (old) old.remove();
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) { fig.hidden = true; return; }
    fig.hidden = false;
    const img = new Image();
    img.alt = 'The Goose painted this round';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (rid !== state.roundId) return;
      fig.append(img);
      requestAnimationFrame(() => fig.classList.add('loaded'));
    };
    img.onerror = () => { if (rid === state.roundId) fig.hidden = true; };
    img.src = url;
  }

  /* ---- solo result ---- */
  function showResult(data) {
    const r = data.results[0] || {};
    const bot = data.bot || {};
    const score = clampScore(r.score);
    const botScore = clampScore(bot.score == null ? 5 : bot.score);
    const outcome = outcomeOf(score, botScore);
    const panel = $('result');

    // bookkeeping first so tallies are right
    if (state.mode === 'free') {
      state.free = nextFreeRound(state.free, outcome);
      state.free.rounds.push({ cards: state.cards, answer: r.answer || '', score, botScore, outcome });
      const st = loadObj(STORAGE.stats) || { wins: 0, losses: 0, draws: 0, best: 0 };
      if (outcome === 'win') st.wins = (st.wins || 0) + 1;
      else if (outcome === 'lose') st.losses = (st.losses || 0) + 1;
      else st.draws = (st.draws || 0) + 1;
      st.best = Math.max(st.best || 0, score);
      save(STORAGE.stats, st);
    } else if (state.mode === 'daily') {
      // Save against the day the cards were dealt for, not the wall clock: crossing midnight
      // mid-answer must not mark tomorrow's Gaggle as played with today's cards.
      const today = state.dailyIndex == null ? dayIndexFor() : state.dailyIndex;
      const prev = loadObj(STORAGE.daily) || {};
      const streak = prev.lastPlayedDay === today - 1 ? (Number(prev.streak) || 0) + 1 : 1;
      save(STORAGE.daily, {
        dayIndex: today,
        cards: state.cards,
        answer: r.answer || '',
        score,
        botScore,
        verdict: r.verdict || bandHeadline(score),
        badge: r.badge || '',
        streak,
        lastPlayedDay: today,
        best: Math.max(Number(prev.best) || 0, score),
      });
    }
    $('tally').textContent = tallyText();

    panel.dataset.band = bandFor(score);
    panel.classList.toggle('sad', score <= 2);
    $('resultVerdict').textContent = r.verdict || bandHeadline(score);
    $('resultWho').textContent = playerName();
    $('resultAnswer').textContent = r.answer || '…';
    $('resultScoreNum').textContent = '0';
    setBar($('resultBar'), score);
    $('resultHits').innerHTML = hitsHtml(Array.isArray(r.hits) ? r.hits : []);
    const b = badgeInfo(r.badge);
    const badgeEl = $('resultBadge');
    badgeEl.textContent = `${b.emoji} ${b.label}`;
    badgeEl.classList.remove('pop');
    $('resultQuip').textContent = r.comment || '';
    $('resultQuip').classList.remove('in');

    const gooseRow = $('gooseRow');
    gooseRow.classList.add('is-hidden');
    $('gooseAnswer').textContent = bot.answer || 'a silence of geese';
    $('gooseScore').textContent = String(botScore);
    $('gooseBar').style.setProperty('--pct', `${botScore * 10}%`);

    const stamp = $('resultStamp');
    stamp.hidden = true;
    stamp.className = 'stamp';
    const outcomeEl = $('resultOutcome');
    outcomeEl.textContent = '';

    // actions
    const primary = $('resultPrimaryBtn');
    const secondary = $('resultSecondaryBtn');
    if (state.mode === 'free') {
      primary.textContent = state.free.over ? 'Match result →' : 'Next round →';
      primary.dataset.action = state.free.over ? 'match' : 'next';
      secondary.textContent = 'Share';
      secondary.dataset.action = 'share';
    } else {
      primary.textContent = 'Share';
      primary.dataset.action = 'share';
      secondary.textContent = 'Home';
      secondary.dataset.action = 'home';
    }

    loadImage($('resultImg'), data.imageUrl);
    panel.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });

    const rid = state.roundId;
    countUp($('resultScoreNum'), score, 700).then(() => {
      if (rid !== state.roundId) return;
      later(() => badgeEl.classList.add('pop'), 150);
      later(() => $('resultQuip').classList.add('in'), 250);
      later(() => gooseRow.classList.remove('is-hidden'), 600);
      later(() => {
        stamp.textContent = outcome === 'win' ? 'YOU WIN' : outcome === 'lose' ? 'GOOSE WINS' : 'DRAW';
        stamp.className = `stamp stamp--${outcome}`;
        stamp.hidden = false;
        panel.classList.add(`is-${outcome}`);
        setMood('resultGoose', moodFor(score, botScore));
        const diff = Math.abs(score - botScore);
        outcomeEl.textContent = outcome === 'win'
          ? `You beat the Goose by ${diff}!`
          : outcome === 'lose'
            ? `The Goose wins by ${diff}. honk.`
            : 'Dead heat. The Goose is furious.';
        if (score >= 9 || (outcome === 'win' && diff >= 3)) confetti($('resultConfetti'));
      }, 1150);
      later(() => renderAlternatives('alsoIn', 'alsoInList', data.alternatives), 1450);
    });
  }

  function showDailyDone(d) {
    const score = clampScore(d.score);
    const botScore = clampScore(d.botScore);
    const outcome = outcomeOf(score, botScore);
    $('doneVerdict').textContent = d.verdict || bandHeadline(score);
    $('doneSub').textContent = "You've already played today's Gaggle.";
    $('doneAnswer').textContent = d.answer || '…';
    $('doneScore').textContent = String(score);
    $('doneBar').style.setProperty('--pct', `${score * 10}%`);
    const b = badgeInfo(d.badge);
    $('doneBadge').textContent = `${b.emoji} ${b.label}`;
    $('doneOutcome').textContent = gooseLine(score, botScore);
    $('doneMeta').textContent = `🔥 ${d.streak || 1}-day streak · best ${d.best || score}/10`;
    $('dailyDone').dataset.band = bandFor(score);
    $('dailyDone').classList.remove('is-win', 'is-lose', 'is-draw');
    $('dailyDone').classList.add(`is-${outcome}`);
    updateCountdown();
  }

  function updateCountdown() {
    $('doneCountdown').textContent = formatCountdown(msUntilMidnight());
    if (state.screen === 'home') renderHome();
    // Midnight passed while the "already played" panel was open: the countdown would otherwise
    // wrap to "24h 0m" over yesterday's result. Deal the new Gaggle instead.
    if (state.screen === 'game' && state.mode === 'daily' && state.phase === 'dailyDone'
        && state.dailyIndex != null && state.dailyIndex !== dayIndexFor()) {
      toast('🪿 A new Gaggle is ready!');
      startDaily();
    }
  }

  /* ---- party podium ---- */
  function showPodium(data) {
    const entries = rankEntries(data.results, data.bot);
    const party = state.party;
    entries.forEach((e) => {
      party.totals[e.name] = (party.totals[e.name] || 0) + e.score;
      if (!e.goose && (!party.best || e.score > party.best.score)) {
        party.best = { name: e.name, answer: e.answer, score: e.score, cards: state.cards };
      }
    });
    party.rounds.push({ cards: state.cards, entries });
    state.lastEntries = entries;
    $('tally').textContent = tallyText();

    $('podiumTitle').textContent = `Round ${state.round} results`;
    const list = $('rankList');
    list.innerHTML = '';
    entries.forEach((e, i) => {
      const li = document.createElement('li');
      li.className = `rank-row is-hidden${e.goose ? ' rank-row--goose' : ''}`;
      li.dataset.band = bandFor(e.score);
      li.style.setProperty('--pct', `${e.score * 10}%`);
      const hits = e.goose ? '' : `<div class="hits hits--small">${hitsHtml(e.hits)}</div>`;
      const badge = e.goose || !e.badge ? '' : `<span class="mini-badge">${badgeInfo(e.badge).emoji} ${escapeHtml(badgeInfo(e.badge).label)}</span>`;
      li.innerHTML = `
        <span class="rank-medal">${medal(i + 1)}</span>
        <span class="rank-name">${e.goose ? '🪿 ' : ''}${escapeHtml(e.name)}</span>
        <span class="score"><b>${e.score}</b><small>/10</small></span>
        <q class="rank-answer">${escapeHtml(e.answer || '(said nothing)')}</q>
        <div class="bar"><i></i></div>
        <span class="rank-verdict">${escapeHtml(e.verdict)}${badge}</span>
        ${e.comment ? `<p class="rank-comment">${escapeHtml(e.comment)}</p>` : ''}
        ${hits}`;
      list.append(li);
    });

    const tallyLine = rankTotals(party.totals)
      .map((t) => `${t.goose ? '🪿' : t.name} ${t.total}`).join(' · ');
    $('podiumTally').textContent = `After round ${state.round}: ${tallyLine}`;
    $('podiumNextBtn').textContent = state.round >= PARTY_ROUNDS ? 'See the champion 🏆' : 'Next round →';
    loadImage($('podiumImg'), data.imageUrl);
    $('podium').scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });

    const rows = Array.from(list.children);
    const gap = reducedMotion() ? 0 : 600;
    rows.slice().reverse().forEach((row, i) => {
      later(() => {
        row.classList.remove('is-hidden');
        if (row === rows[0]) {
          row.classList.add('is-winner');
          confetti($('podiumConfetti'));
        }
      }, 200 + gap * i);
    });
    later(() => renderAlternatives('podiumAlsoIn', 'podiumAlsoInList', data.alternatives), 400 + gap * rows.length);
  }

  function showChampion() {
    const party = state.party;
    const totals = rankTotals(party.totals);
    const top = totals[0];
    const tie = totals.length > 1 && totals[1].total === top.total;
    $('champTitle').textContent = tie
      ? `It's a tie at ${top.total}!`
      : top.goose ? 'The Goose is champion' : `${top.name} is champion!`;
    $('champSub').textContent = tie
      ? 'Share the crown. Or fight.'
      : top.goose ? 'Beaten by a bird. Shame on all of you.' : `${top.total} points over ${PARTY_ROUNDS} rounds.`;
    const list = $('champList');
    list.innerHTML = '';
    const max = Math.max(1, top.total);
    totals.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = `rank-row rank-row--total${t.goose ? ' rank-row--goose' : ''}${i === 0 ? ' is-winner' : ''}`;
      li.style.setProperty('--pct', `${Math.round((t.total / max) * 100)}%`);
      li.innerHTML = `
        <span class="rank-medal">${medal(i + 1)}</span>
        <span class="rank-name">${t.goose ? '🪿 ' : ''}${escapeHtml(t.name)}</span>
        <span class="score"><b>${t.total}</b></span>
        <div class="bar"><i></i></div>`;
      list.append(li);
    });
    $('champBest').textContent = party.best
      ? `Best line: "${party.best.answer}" — ${party.best.name} (${party.best.score}/10)`
      : '';
    state.screen = 'champion';
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    later(() => confetti($('champConfetti')), 300);
  }

  function showMatch() {
    const f = state.free;
    const won = f.you > f.goose;
    const lost = f.goose > f.you;
    $('matchEmoji').textContent = won ? '🏆' : lost ? '🪿' : '🤝';
    $('matchTitle').textContent = won
      ? `You won the match ${f.you}–${f.goose}!`
      : lost ? `The Goose won ${f.goose}–${f.you}` : `Match drawn ${f.you}–${f.goose}`;
    $('matchSub').textContent = won
      ? 'The Goose is sulking somewhere.'
      : lost ? 'Out-punned by poultry. Rematch?' : 'Nobody honked loudest.';
    const st = loadObj(STORAGE.stats) || {};
    $('matchStats').textContent = `Lifetime vs the Goose: ${st.wins || 0}W · ${st.losses || 0}L · ${st.draws || 0}D · best ${st.best || 0}/10`;
    state.screen = 'match';
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (won) later(() => confetti($('matchConfetti')), 300);
  }

  function bestFreeLine() {
    return state.free.rounds.reduce((best, r) => (!best || r.score > best.score ? r : best), null);
  }

  /* ---- share builders (bound to state) ---- */
  function shareCurrent() {
    const data = state.result;
    if (!data) return;
    const r = data.results[0] || {};
    const score = clampScore(r.score);
    const botScore = clampScore(data.bot && data.bot.score != null ? data.bot.score : 5);
    if (state.mode === 'daily') {
      const d = loadObj(STORAGE.daily) || {};
      share(dailyShareText({
        dayIndex: state.dailyIndex == null ? dayIndexFor() : state.dailyIndex, cards: state.cards, score, botScore,
        verdict: r.verdict || bandHeadline(score), streak: d.streak || 1, url: shareUrl('#daily'),
      }));
    } else {
      share(roundShareText({
        cards: state.cards, answer: r.answer || '', score,
        botAnswer: data.bot && data.bot.answer, botScore, url: shareUrl(),
      }));
    }
  }

  /* ---- navigation ---- */
  function goHome() {
    state.roundId += 1;
    clearTimers();
    state.screen = 'home';
    state.mode = null;
    state.phase = 'draw';
    state.party = null;
    state.free = null;
    resetRoundUI();
    if (location.hash) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch { location.hash = ''; }
    }
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function startDaily() {
    state.mode = 'daily';
    state.screen = 'game';
    state.free = null;
    state.party = null;
    newRound();
    const d = loadObj(STORAGE.daily);
    const today = dayIndexFor();
    state.dailyIndex = today;
    if (d && d.lastPlayedDay === today && Array.isArray(d.cards) && d.cards.length === 2
        && d.cards.every((c) => typeof c === 'string')) {
      state.cards = d.cards;
      state.tags = [deckLabelOf(d.cards[0]), 'Scenario'];
      state.phase = 'dailyDone';
      render();
      renderCards(d.cards, state.tags, true);
      showDailyDone(d);
    } else {
      state.phase = 'draw';
      render();
      if (decks.loaded) drawCards();
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function startFree() {
    state.mode = 'free';
    state.screen = 'game';
    state.free = freshFree();
    state.party = null;
    newRound();
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function startSetup() {
    state.mode = 'party';
    state.screen = 'setup';
    if (!state.setupNames.length) state.setupNames = ['', ''];
    renderSetup();
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function startParty(players) {
    state.mode = 'party';
    state.players = players;
    state.party = freshParty(players);
    state.round = 1;
    state.screen = 'game';
    newRound();
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ---- party setup UI ---- */
  function renderSetup() {
    const list = $('playerList');
    list.innerHTML = '';
    state.setupNames.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'player-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 24;
      input.value = name;
      input.placeholder = `Player ${i + 1}`;
      input.autocomplete = 'off';
      input.setAttribute('aria-label', `Player ${i + 1} name`);
      input.addEventListener('input', () => { state.setupNames[i] = input.value; renderSetupStart(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (i === state.setupNames.length - 1 && state.setupNames.length < MAX_PLAYERS && input.value.trim()) addPlayerRow();
          else $('startPartyBtn').click();
        }
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn-ghost player-del';
      del.textContent = '✕';
      del.setAttribute('aria-label', `Remove player ${i + 1}`);
      del.addEventListener('click', () => { state.setupNames.splice(i, 1); renderSetup(); });
      row.append(input, del);
      list.append(row);
    });
    $('addPlayerBtn').hidden = state.setupNames.length >= MAX_PLAYERS;

    const recent = loadArr(STORAGE.players).filter((n) => typeof n === 'string' && n.trim());
    const current = state.setupNames.map((n) => n.trim().toLowerCase());
    const chips = recent.filter((n) => !current.includes(n.toLowerCase()));
    const chipBox = $('recentChips');
    chipBox.innerHTML = '';
    chipBox.hidden = chips.length === 0;
    chips.forEach((n) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip';
      c.textContent = `+ ${n}`;
      c.addEventListener('click', () => {
        const empty = state.setupNames.findIndex((x) => !x.trim());
        if (empty >= 0) state.setupNames[empty] = n;
        else if (state.setupNames.length < MAX_PLAYERS) state.setupNames.push(n);
        else return;
        renderSetup();
      });
      chipBox.append(c);
    });
    renderSetupStart();
  }

  function addPlayerRow() {
    if (state.setupNames.length >= MAX_PLAYERS) return;
    state.setupNames.push('');
    renderSetup();
    const inputs = $('playerList').querySelectorAll('input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function renderSetupStart() {
    const n = state.setupNames.filter((x) => x.trim()).length;
    const btn = $('startPartyBtn');
    btn.disabled = n < MIN_PLAYERS;
    btn.textContent = n < MIN_PLAYERS ? `Start 🪿 (need ${MIN_PLAYERS - n} more)` : `Start with ${n} players 🪿`;
  }

  /* ---- settings UI ---- */
  function renderSettings() {
    const box = $('deckToggles');
    box.innerHTML = '';
    NOUN_DECKS.forEach((d) => {
      const label = document.createElement('label');
      label.className = 'deck-toggle';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = d.key;
      cb.checked = settings.decks.includes(d.key);
      cb.addEventListener('change', () => {
        const next = NOUN_DECKS.filter((x) => box.querySelector(`input[value="${x.key}"]`).checked).map((x) => x.key);
        if (!next.length) { cb.checked = true; toast('Keep at least one deck on 🪿'); return; }
        settings.decks = next;
        save(STORAGE.decks, next);
      });
      const span = document.createElement('span');
      span.textContent = d.label;
      label.append(cb, span);
      box.append(label);
    });
    $('diffToggles').querySelectorAll('input[name="difficulty"]').forEach((r) => {
      r.checked = r.value === settings.difficulty;
    });
    $('diffHint').textContent = diffHintText(settings.difficulty);
    $('spicyToggle').checked = settings.spicy;
    $('soloName').value = settings.name;
  }

  /* ---- wiring ---- */
  function bind() {
    document.querySelectorAll('[data-home]').forEach((b) => b.addEventListener('click', goHome));
    $('dailyBtn').addEventListener('click', startDaily);
    $('freeBtn').addEventListener('click', startFree);
    $('partyBtn').addEventListener('click', startSetup);

    $('diffToggles').addEventListener('change', (e) => {
      const v = e.target && e.target.value;
      if (!DIFFICULTIES.includes(v)) return;
      settings.difficulty = v;
      save(STORAGE.difficulty, v);
      $('diffHint').textContent = diffHintText(v);
    });
    $('spicyToggle').addEventListener('change', (e) => { settings.spicy = e.target.checked; save(STORAGE.spicy, settings.spicy); });
    $('soloName').addEventListener('input', (e) => { settings.name = e.target.value.slice(0, 24); save(STORAGE.name, settings.name); });

    $('drawBtn').addEventListener('click', drawCards);
    $('drawAgainBtn').addEventListener('click', () => { if (state.mode === 'free' && state.phase === 'answer') drawCards(); });
    $('answerForm').addEventListener('submit', (e) => { e.preventDefault(); submitAnswer(); });
    $('answerInput').addEventListener('input', () => { $('answerError').hidden = true; });
    $('skipBtn').addEventListener('click', () => { if (state.mode === 'party' && state.phase === 'answer') lockIn(''); });
    $('retryJudgeBtn').addEventListener('click', () => { if (state.judgeError) { state.phase = 'answer'; judge(); } });

    $('curtainOkBtn').addEventListener('click', () => {
      if (state.phase !== 'curtain') return;
      state.phase = 'answer';
      render();
      focusInput();
    });
    $('curtainQuitBtn').addEventListener('click', () => {
      if (state.phase !== 'curtain') return;
      if (window.confirm('Quit this party game? The scores so far will be lost.')) goHome();
    });

    const resultAction = (btn) => {
      if (state.phase !== 'result') return; // a second tap after leaving the panel must be a no-op
      const a = btn.dataset.action;
      if (a === 'share') shareCurrent();
      else if (a === 'home') goHome();
      else if (a === 'next') drawCards();
      else if (a === 'match') showMatch();
    };
    $('resultPrimaryBtn').addEventListener('click', (e) => resultAction(e.currentTarget));
    $('resultSecondaryBtn').addEventListener('click', (e) => resultAction(e.currentTarget));

    $('doneShareBtn').addEventListener('click', () => {
      const d = loadObj(STORAGE.daily);
      if (!d || !Array.isArray(d.cards) || d.cards.length !== 2) return;
      share(dailyShareText({
        dayIndex: d.dayIndex, cards: d.cards, score: d.score, botScore: d.botScore,
        verdict: d.verdict || bandHeadline(d.score), streak: d.streak || 1, url: shareUrl('#daily'),
      }));
    });

    $('matchShareBtn').addEventListener('click', () => {
      share(matchShareText({ you: state.free.you, goose: state.free.goose, best: bestFreeLine(), url: shareUrl() }));
    });
    $('rematchBtn').addEventListener('click', () => { startFree(); drawCards(); });

    $('podiumNextBtn').addEventListener('click', () => {
      if (state.phase !== 'podium') return; // double-tap would bump the round counter twice
      if (state.round >= PARTY_ROUNDS) { showChampion(); return; }
      state.round += 1;
      newRound();
      render();
      window.scrollTo({ top: 0, behavior: 'auto' });
      drawCards();
    });
    $('podiumShareBtn').addEventListener('click', () => {
      if (!state.lastEntries) return;
      share(partyRoundShareText({ cards: state.cards, entries: state.lastEntries, url: shareUrl() }));
    });

    $('champShareBtn').addEventListener('click', () => {
      share(partyShareText({ rounds: PARTY_ROUNDS, totals: rankTotals(state.party.totals), best: state.party.best, url: shareUrl() }));
    });
    $('samePlayersBtn').addEventListener('click', () => startParty(state.players.slice()));
    $('changePlayersBtn').addEventListener('click', () => { state.setupNames = state.players.slice(); startSetup(); });

    $('addPlayerBtn').addEventListener('click', addPlayerRow);
    $('startPartyBtn').addEventListener('click', () => {
      const players = dedupeNames(state.setupNames).slice(0, MAX_PLAYERS);
      if (players.length < MIN_PLAYERS) { toast('Need at least two players 🪿'); return; }
      save(STORAGE.players, players);
      state.setupNames = players.slice();
      startParty(players);
    });

    // Tap anywhere on the result to skip the choreography? Keep it simple: no.
    window.addEventListener('hashchange', () => {
      if (location.hash === '#daily' && state.mode !== 'daily') startDaily();
    });
  }

  /* ---- boot ---- */
  mountGoose('watermarkGoose', 'idle');
  mountGoose('heroGoose', 'idle');
  mountGoose('judgingGoose', 'deliberating');
  mountGoose('judgeBoxGoose', 'deliberating');
  mountGoose('resultGoose', 'deliberating');
  renderSettings();
  bind();
  render();
  loadDecks();
  setInterval(updateCountdown, 30000);
  if (location.hash === '#daily') startDaily();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
  else startApp();
}

/* Node-only export of the pure helpers (harmless in the browser). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EPOCH_UTC, NOUN_DECKS, SCENARIO_PATH, STORAGE, HITS, BADGES, GOOSE_NAME,
    PARTY_ROUNDS, FREE_TARGET, FREE_MAX,
    mulberry32, dayIndexFor, combinedNouns, pickDaily, msUntilMidnight, formatCountdown,
    DIFFICULTIES, DAILY_MIX, matchesTier, tierForRound, tierPool, dailyTier, diffHintText,
    clampScore, bandFor, bandHeadline, badgeInfo, outcomeOf, moodFor, scoreBar, cardsTitle, medal,
    gooseLine, dailyShareText, roundShareText, matchShareText, partyRoundShareText, partyShareText,
    rankEntries, rankTotals, dedupeNames, answerPlaceholder, nextFreeRound,
  };
}
