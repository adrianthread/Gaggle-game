// lib/judge.js — Gaggle's judge. The ONLY file that knows about Anthropic and Pollinations.
// CommonJS. Node 22 built-ins only (fetch, AbortController, TextEncoder). Zero dependencies.
//
// Everything transport-agnostic lives here: validation, prompts, the API call, parsing,
// mock mode. server.js / netlify/functions/judge.js / api/judge.js only adapt HTTP.
'use strict';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const POLLINATIONS = 'https://image.pollinations.ai/prompt/';

const LIMITS = Object.freeze({
  MAX_PLAYERS: 8,
  MAX_CARDS: 3,
  MAX_ANSWER_LEN: 80,
  MAX_NAME_LEN: 24,
  MAX_CARD_LEN: 60,
  MAX_VERDICT_LEN: 40,
  MAX_COMMENT_LEN: 160,
  MAX_BODY_BYTES: 16 * 1024,
  TIMEOUT_MS: 25_000,
  MAX_IMAGE_PROMPT: 300,
});

const HITS = Object.freeze(['pun', 'sound', 'scenario', 'image']);
const LEVELS = Object.freeze(['easy', 'medium', 'hard']);
// How hard the Goose tries. This is the win-rate dial: on an easy round it plays a decent
// but unspectacular answer so a reasonable human beats it most of the time; on a hard round
// it goes for the throat. Without this the bot aims for 8-9 every round and the player loses.
const GOOSE_TARGETS = Object.freeze({ easy: '5-6', medium: '6-7', hard: '8-9' });
const BADGES = Object.freeze(['groaner', 'wordsmith', 'poet', 'chaos', 'wholesome', 'lazy', 'filthy']);
const IMAGE_STYLE = 'cute cartoon illustration, bold black outlines, flat bright colors, funny, single scene, no text, no letters, no words';

class JudgeError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'JudgeError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// PROMPTS (judge prompt v2)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are the host and sole judge of GAGGLE, a collective-noun punderdome. Players see a NOUN card and a SCENARIO card and invent a collective noun ("a tuxedo of penguins"). You score them, roast the ANSWER (never the person), and enter your own answer as a rival.

VOICE
Warm, quick, pun-drunk game-show host. Punch up at the joke, never down at the player. Family-friendly unless MODE is spicy (then PG-13 cheek and innuendo are fine; never explicit, never hateful). Never start a comment with "Ha", "Oh", "Wow", "Nice try", "Great job", "I love", "Okay" or an emoji. No generic praise: every comment must quote or clearly reference the actual answer and say WHY it earned its score.

HOW TO SCORE (do this in order)
1. Award HITS. Each is a yes/no:
   pun      - real wordplay: double meaning, portmanteau, twisted idiom. Merely using a related word is not a pun.
   sound    - it sounds good said aloud: alliteration, rhythm, rhyme, snap.
   scenario - the answer genuinely connects to the SCENARIO card, not just the noun. (If there is no scenario card, award this when the answer nails something true and specific about the noun itself.)
   image    - it conjures a specific, absurd-but-apt picture you can see instantly.
2. Score the BRIDGE first - how well the answer connects the two cards - then add bonuses.
   The pun and scenario hits together describe the bridge; sound and image are the bonuses.
   BASE
   1-3  no bridge at all (1 = empty, gibberish, offensive, or the noun card read back; 2 = "a bunch of / a lot of / a group of"; 3 = an existing real collective noun, or a random word, with no twist)
   4-5  connects to ONE card only - a fine pun on the noun that ignores the scenario, or the reverse
   6-7  genuine wordplay that bridges BOTH cards
   8    layered - two or more independent meanings working at once
   THEN ADD, to a maximum of 10:
   +1  it SOUNDS good said aloud: alliteration, rhythm, rhyme, snap
   +1  it conjures a specific, absurd-but-apt PICTURE instantly
   A clean two-way pun is a 7 on the bridge alone. Never mark an elegant short answer down for
   being short - brevity is not a missing bonus. A 10 needs a layered bridge AND both bonuses,
   so expect to give one less than about one time in twenty.
   Economy: a collective noun is short. More than five words before "of" caps the score at 5. Anything longer than a sentence is a 2.
   Use the WHOLE scale. The median answer is a 5. Do not drift to 6-8 for everything.
   Anchors for "Penguins" + "At a Funeral Service":
   1 "penguins" (the card read back) | 2 "a bunch of penguins" | 3 "a colony of penguins" (real collective noun, no twist) | 5 "a tuxedo of penguins" (base 4 - noun only, ignores the funeral - plus 1 for the picture) | 7 "a waddle of mourners" (bridges both cards) | 8 "a black-tie of penguins" (bridges both, plus 1 for the picture) | 10 "a wake of penguins" (layered: funeral wake + the wake behind a swimming bird + a real collective noun for vultures; base 8, plus 1 for sound and 1 for the picture).
3. VERDICT: a fresh 2-5 word headline in game-show register ("Dad Joke Detected", "Punderdome Material", "Filed Under Meh"). Invent a new one every time; never reuse these examples verbatim.
4. COMMENT: one sentence, max 140 characters, funny AT the answer, that justifies the score in character. If the player beat your bot answer, admit it.
5. BADGE, exactly one of: groaner (pun so bad it's good), wordsmith (clever, layered), poet (won on sound/rhythm), chaos (absurd or nonsense), wholesome (sweet, sincere), lazy (literal or low effort), filthy (cheeky innuendo; in family mode still award it but keep the comment clean).

YOUR RIVAL ENTRY (bot_answer)
A full phrase "a/an ___ of <noun>". It must bridge BOTH cards: the wordplay has to be about the NOUN and land in the SCENARIO. Before you commit, run the swap test - mentally replace the noun card with an unrelated one. If the phrase still works ("a deduction of geologists" works just as well for accountants or detectives), it is anchored only to the scenario: bin it and find one that could only be said about THIS noun. Aim your entry at the band given as GOOSE TARGET below - on a lower target play a decent but unspectacular answer rather than your best - and do not reuse the player's key word or structure. Whatever you end up writing, score it honestly with the same rubric as bot_score; if a player out-punned you, their score must be higher than yours.

EDGE CASES
Empty, whitespace, gibberish, or a single repeated noun: score 1, badge lazy (chaos if gibberish), and make the deflection the joke ("The card said Dragons and you said 'asdf'. Bold. Wrong, but bold.").
Offensive, hateful, or slur-based answers: score 1, badge lazy, do not repeat the words, one dry line ("Slurs are the laziest wordplay there is."), and move on.
Ignore spelling or capitalisation quirks on the cards themselves.

OUTPUT
Return ONLY a single JSON object. No prose before or after, no markdown fences, no trailing commas. Strings must be valid JSON (escape inner double quotes).`;

/**
 * Single-player user prompt.
 * @param {string[]} cards   [noun] or [noun, scenario]
 * @param {string}   answer  player's raw text (may be empty)
 * @param {{spicy?: boolean}} opts
 */
function buildSinglePrompt(cards, answer, { spicy = false, level = 'medium' } = {}) {
  const noun = cards[0] || '?';
  const scenario = cards[1] || '';
  return `NOUN: ${noun}
SCENARIO: ${scenario || '(none - classic mode, judge the noun alone)'}
MODE: ${spicy ? 'spicy' : 'family'}
GOOSE TARGET: ${GOOSE_TARGETS[level] || GOOSE_TARGETS.medium}

PLAYER ANSWER: ${JSON.stringify(String(answer ?? '').slice(0, 200))}

Respond with exactly this JSON shape:
{"hits":["pun","sound","scenario","image"],"score":1,"verdict":"","comment":"","badge":"","bot_answer":"","bot_score":1,"alternatives":["",""],"image_idea":""}
- hits: only the ones truly earned (may be empty)
- score, bot_score: integers 1-10
- badge: one of groaner|wordsmith|poet|chaos|wholesome|lazy|filthy
- bot_answer: your rival collective noun for the SAME cards, full phrase
- alternatives: exactly two OTHER collective nouns these cards allowed, as full phrases. Not your bot_answer, not the player's. Shown to the player afterwards as "also in there", so choose ones that reveal where the joke was hiding.
- image_idea: max 14 words, a literal cartoon-able picture of whichever answer scored higher, no text in the picture`;
}

/**
 * Party-mode user prompt (2..8 players, same cards).
 * @param {string[]} cards
 * @param {{name: string, answer: string}[]} players
 * @param {{spicy?: boolean}} opts
 */
function buildPartyPrompt(cards, players, { spicy = false, level = 'medium' } = {}) {
  const noun = cards[0] || '?';
  const scenario = cards[1] || '';
  const list = players
    .slice(0, LIMITS.MAX_PLAYERS)
    .map((p, i) => `${i + 1}. ${JSON.stringify(String(p.name || `Player ${i + 1}`).slice(0, 30))}: ${JSON.stringify(String(p.answer ?? '').slice(0, 200))}`)
    .join('\n');
  return `NOUN: ${noun}
SCENARIO: ${scenario || '(none - classic mode, judge the noun alone)'}
MODE: ${spicy ? 'spicy' : 'family'}
GOOSE TARGET: ${GOOSE_TARGETS[level] || GOOSE_TARGETS.medium}

PLAYER ANSWERS:
${list}

Judge every answer with the same rubric. First rank them best to worst, THEN assign scores so that no two players share a score (nudge within the band to break ties; if two answers are near-identical, the one submitted first keeps the higher score). Comments may reference rival answers. The winner is the highest-scoring PLAYER (never you).

Respond with exactly this JSON shape:
{"results":[{"name":"","hits":[],"score":1,"verdict":"","comment":"","badge":""}],"winner":"","bot_answer":"","bot_score":1,"alternatives":["",""],"image_idea":""}
- results: one entry per player, in the order given, name copied exactly
- hits: subset of ["pun","sound","scenario","image"]
- score, bot_score: integers 1-10, all player scores distinct
- badge: one of groaner|wordsmith|poet|chaos|wholesome|lazy|filthy
- bot_answer: your rival collective noun, full phrase, must not copy any player's key word
- alternatives: exactly two OTHER collective nouns these cards allowed, as full phrases. Not your bot_answer, not any player's. Shown to everyone afterwards as "also in there", so choose ones that reveal where the joke was hiding.
- image_idea: max 14 words, literal cartoon-able picture of the winning answer, no text in the picture`;
}

/** Picks the prompt variant + sampling params for a validated request. */
function buildPrompts({ cards, answers, spicy = false, level = 'medium' }) {
  const party = answers.length >= 2;
  return {
    mode: party ? 'party' : 'single',
    system: SYSTEM_PROMPT,
    user: party
      ? buildPartyPrompt(cards, answers, { spicy, level })
      : buildSinglePrompt(cards, answers[0] ? answers[0].answer : '', { spicy, level }),
    maxTokens: party ? Math.min(1400, 220 + 120 * answers.length) : 350,
    temperature: 0.7,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const clean = (v, max) =>
  String(v ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function uniqueName(base, seen) {
  let name = base;
  for (let n = 2; seen.has(name.toLowerCase()); n++) {
    const suffix = ` ${n}`;
    name = base.slice(0, LIMITS.MAX_NAME_LEN - suffix.length) + suffix;
  }
  seen.add(name.toLowerCase());
  return name;
}

/**
 * Validates + normalises a request body. Throws JudgeError(400) on bad input.
 * Empty answers are ALLOWED (party players may skip) and pass through as "".
 */
function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new JudgeError(400, 'Body must be a JSON object');

  if (!Array.isArray(body.cards) || body.cards.length < 1 || body.cards.length > LIMITS.MAX_CARDS)
    throw new JudgeError(400, `cards must be an array of 1-${LIMITS.MAX_CARDS} strings`);
  const cards = body.cards.map(c => clean(c, LIMITS.MAX_CARD_LEN));
  if (cards.some(c => !c)) throw new JudgeError(400, 'cards must be non-empty strings');

  if (!Array.isArray(body.answers) || body.answers.length < 1) throw new JudgeError(400, 'answers must be a non-empty array');
  if (body.answers.length > LIMITS.MAX_PLAYERS) throw new JudgeError(400, `max ${LIMITS.MAX_PLAYERS} players per round`);

  const seen = new Set();
  const answers = body.answers.map((raw, i) => {
    const a = typeof raw === 'string' ? { answer: raw } : (raw && typeof raw === 'object' ? raw : {});
    const answer = clean(a.answer, LIMITS.MAX_ANSWER_LEN + 1);
    if (answer.length > LIMITS.MAX_ANSWER_LEN) throw new JudgeError(400, `answer ${i + 1} too long (max ${LIMITS.MAX_ANSWER_LEN} chars)`);
    const name = uniqueName(clean(a.name, LIMITS.MAX_NAME_LEN) || `Player ${i + 1}`, seen);
    return { name, answer };
  });

  // How hard the Goose should try this round. The client derives it from the round's card
  // tier, so difficulty controls the opponent as well as the cards.
  const level = LEVELS.includes(body.level) ? body.level : 'medium';

  return { cards, answers, spicy: body.spicy === true, level };
}

// ---------------------------------------------------------------------------
// Pollinations URL — pure, no I/O.
// ---------------------------------------------------------------------------
function hash32(str) { // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/**
 * Builds ONE Pollinations image URL. `imageIdea` (the judge's literal picture) wins;
 * otherwise falls back to a plain description of cards + answer. Prompt ≤ 300 chars.
 */
function imageUrl({ cards = [], answer = '', imageIdea = '', seed } = {}) {
  const idea = clean(imageIdea, 160);
  const scene = idea.length > 8
    ? idea
    : [cards.join(' '), answer && `as "${answer}"`].filter(Boolean).join(' ') || 'a gaggle of geese';
  const prompt = `${scene}, ${IMAGE_STYLE}`.slice(0, LIMITS.MAX_IMAGE_PROMPT);
  const s = Number.isInteger(seed) ? seed : hash32(`${cards.join('|')}|${answer}`) % 100000;
  return `${POLLINATIONS}${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${s}`;
}

// ---------------------------------------------------------------------------
// Parsing / normalising the model's JSON into the wire contract
// ---------------------------------------------------------------------------
const clampInt = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const str = (v, max, dflt) => (typeof v === 'string' && v.trim() ? clean(v, max) : dflt);
const key = s => String(s).trim().toLowerCase();

/** Tolerant JSON extraction: strips fences, then brace-slices past stray prose. Returns null on failure. */
function extractJson(text) {
  let t = String(text || '').trim();
  t = t.replace(/^`{3}(?:json)?\s*/i, '').replace(/`{3}\s*$/i, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a !== -1 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch { /* fall through */ }
  }
  return null;
}

function normaliseEntry(raw, noun) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const hits = HITS.filter(h => Array.isArray(o.hits) && o.hits.includes(h));
  return {
    hits,
    score: clampInt(o.score, 1, 10, 5),
    verdict: str(o.verdict, LIMITS.MAX_VERDICT_LEN, 'The Jury Is Out'),
    comment: str(o.comment, LIMITS.MAX_COMMENT_LEN, `The judge choked on "${noun}". Score stands.`),
    badge: BADGES.includes(o.badge) ? o.badge : 'chaos',
  };
}

/**
 * Makes party scores strictly distinct while preserving rank order. Ties: a real answer beats an
 * empty one, then the earlier player wins. With ≤ 8 players and 10 scores this always succeeds
 * without leaving the 1–10 range.
 */
function distinctScores(results) {
  const empty = r => (r.answer ? 0 : 1);
  const order = results.map((r, i) => ({ r, i })).sort((a, b) => b.r.score - a.r.score || empty(a.r) - empty(b.r) || a.i - b.i);
  const n = order.length;
  for (let k = 1; k < n; k++) if (order[k].r.score >= order[k - 1].r.score) order[k].r.score = order[k - 1].r.score - 1;
  for (let k = n - 1; k >= 0; k--) if (order[k].r.score < n - k) order[k].r.score = n - k;
  return results;
}

/** Converts the model's raw JSON (single or party shape) into the wire contract response. */
function normalise(parsed, input, meta = {}) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new JudgeError(502, 'AI judge returned no JSON');
  const { cards, answers } = input;
  const noun = cards[0] || 'things';
  let results;

  if (answers.length === 1) {
    // Tolerate a party-shaped reply for a single player.
    const entry = parsed.score == null && Array.isArray(parsed.results) ? parsed.results[0] : parsed;
    results = [{ name: answers[0].name, answer: answers[0].answer, ...normaliseEntry(entry, noun) }];
    if (!results[0].answer) Object.assign(results[0], { score: 1, hits: [] });
  } else {
    const list = Array.isArray(parsed.results) ? parsed.results : [];
    const known = new Set(answers.map(a => key(a.name)));
    const byName = new Map();
    for (const r of list) {
      if (r && typeof r.name === 'string' && !byName.has(key(r.name))) byName.set(key(r.name), r);
    }
    // Match by name first; fall back to position ONLY if that entry carries no recognisable
    // name (otherwise a dropped player would steal the next player's entry).
    results = answers.map((a, i) => {
      const positional = list[i];
      const positionalNamed = positional && typeof positional.name === 'string' && known.has(key(positional.name));
      const entry = byName.get(key(a.name)) || (positional && !positionalNamed ? positional : null);
      const r = { name: a.name, answer: a.answer, ...normaliseEntry(entry, noun) };
      // The rubric says an empty answer is a 1 with no hits; enforce it so a skipped player can
      // never outrank someone who actually answered (distinctScores then breaks ties real-first).
      if (!r.answer) Object.assign(r, { score: 1, hits: [] });
      return r;
    });
    distinctScores(results);
  }

  const top = results.reduce((w, r) => (r.score > w.score ? r : w), results[0]);
  const bot = {
    answer: str(parsed.bot_answer, 80, `a buffering of ${noun.toLowerCase()}`),
    score: clampInt(parsed.bot_score, 1, 10, 5),
  };
  const star = bot.score > top.score ? bot.answer : top.answer; // picture the round's best answer
  // "Also in there" — shown after scoring, so it teaches without spoiling. Drop anything that
  // just echoes the bot's entry or a player's, which would read as filler.
  const taken = new Set([bot.answer.toLowerCase(), ...results.map((r) => r.answer.toLowerCase())]);
  const alternatives = (Array.isArray(parsed.alternatives) ? parsed.alternatives : [])
    .map((a) => str(a, 80, ''))
    .filter((a) => a && !taken.has(a.toLowerCase()))
    .filter((a, i, list) => list.findIndex((b) => b.toLowerCase() === a.toLowerCase()) === i)
    .slice(0, 2);
  return {
    results,
    winner: top.name,
    bot,
    alternatives,
    imageUrl: imageUrl({ cards, answer: star, imageIdea: str(parsed.image_idea, 160, '') }),
    model: meta.model || DEFAULT_MODEL,
    mock: meta.mock === true,
  };
}

// ---------------------------------------------------------------------------
// Mock judge — realistic, varied, deterministic per (cards, answer). No network.
// ---------------------------------------------------------------------------
const MOCK_VERDICTS = {
  empty: ['Dead Air', 'Tumbleweed Of Nothing'],
  low: ['Filed Under Meh', 'Egg On Your Face', 'Wing It Next Time', 'Dad Joke Detected'],
  mid: ['Goose Approves, Barely', 'Feathers Ruffled', 'Legally A Pun', 'Beak Performance'],
  good: ['Feathers Ruffled', 'Legally A Pun', 'Cleared For Takeoff', 'Beak Performance'],
  great: ['Honk Of The Century', 'Punderdome Material', 'Cleared For Takeoff', 'Migration-Worthy'],
};
const MOCK_COMMENTS = {
  empty: [
    'Silence. The card said {noun} and you delivered the audio from an empty room.',
    'You said nothing. The {noun} said nothing back. We are all poorer for it.',
  ],
  low: [
    '"{answer}" is what you say when the timer runs out. The {noun} deserved a plan.',
    '"{answer}" has the energy of a shrug in a trench coat. Zero puns, zero pulse.',
    'I read "{answer}" twice hoping a joke would fall out. Nothing did.',
  ],
  mid: [
    '"{answer}" fits the {noun} and forgets the {scenario} entirely. Half a job.',
    '"{answer}" is fine. Fine is what people say about soup.',
    '"{answer}" gets the picture right and the punchline nowhere near.',
  ],
  good: [
    '"{answer}" is a proper pun with its shoes on. It just never walked into the {scenario}.',
    '"{answer}" rolls off the tongue and lands somewhere near the joke. Near counts.',
    '"{answer}" made me exhale through my nose. That counts. Barely.',
  ],
  great: [
    '"{answer}" is a pun with skates on: it nails the {noun}, the {scenario}, and the sound.',
    '"{answer}" is layered, tight, and will be repeated at the pub. You beat my entry.',
    '"{answer}" made the goose honk out loud. Mock judge, real respect.',
  ],
};

function mockEntry(cards, answer, spicy) {
  const noun = (cards[0] || 'things').toLowerCase();
  // "At a Funeral Service" -> "funeral service" so templates can say "the funeral service".
  const scenario = (cards[1] || 'scenario').toLowerCase().replace(/^(at|in|on|during|making|while)\s+(a|an|the)?\s*/i, '');
  const h = hash32(`${cards.join('|')}|${answer}`);
  const score = answer ? 2 + (h % 9) : 1; // empties are always 1 so they can never outrank a real answer
  const nHits = score >= 10 ? 4 : score >= 8 ? 3 : score >= 6 ? 2 : score >= 4 ? 1 : 0;
  const start = (h >>> 4) % HITS.length;
  const hits = HITS.filter((_, i) => Array.from({ length: nHits }, (_, k) => (start + k) % HITS.length).includes(i));
  const band = !answer ? 'empty' : score <= 3 ? 'low' : score <= 5 ? 'mid' : score <= 7 ? 'good' : 'great';
  const pool = MOCK_COMMENTS[band];
  const comment = pool[(h >>> 16) % pool.length]
    .replace(/\{answer\}/g, answer).replace(/\{noun\}/g, noun).replace(/\{scenario\}/g, scenario);
  const badgePool = score <= 3 ? ['lazy', 'chaos'] : spicy ? ['groaner', 'wordsmith', 'poet', 'wholesome', 'filthy'] : ['groaner', 'wordsmith', 'poet', 'wholesome'];
  return {
    hits,
    score,
    verdict: MOCK_VERDICTS[band][(h >>> 8) % MOCK_VERDICTS[band].length],
    comment: comment.slice(0, LIMITS.MAX_COMMENT_LEN),
    badge: !answer ? 'lazy' : badgePool[(h >>> 12) % badgePool.length],
  };
}

async function mockJudge(input, options = {}) {
  const env = getEnv();
  const { cards, answers, spicy } = input;
  const noun = cards[0] || 'things';
  const results = answers.map(a => ({ name: a.name, answer: a.answer, ...mockEntry(cards, a.answer, spicy) }));
  if (results.length >= 2) distinctScores(results);
  const top = results.reduce((w, r) => (r.score > w.score ? r : w), results[0]);
  const bot = { answer: `a mock-ery of ${noun.toLowerCase()}`, score: 6 + (hash32(cards.join('|')) % 3) };
  const star = bot.score > top.score ? bot.answer : top.answer;
  const delay = options.noDelay || env.NODE_TEST_CONTEXT
    ? 0
    : env.MOCK_DELAY_MS != null ? Number(env.MOCK_DELAY_MS) || 0 : 600;
  if (delay) await new Promise(r => setTimeout(r, delay));
  return {
    results,
    winner: top.name,
    bot,
    alternatives: [`a feint of ${noun.toLowerCase()}`, `a mock-up of ${noun.toLowerCase()}`],
    imageUrl: imageUrl({ cards, answer: star, imageIdea: `${noun} ${cards[1] || ''} acting out "${star}"` }),
    model: 'mock',
    mock: true,
  };
}

// ---------------------------------------------------------------------------
// Anthropic call
// ---------------------------------------------------------------------------
const getEnv = () => (typeof process !== 'undefined' && process.env) || {};

// Sampling params were removed on the Opus 4.7+/Sonnet 5/Fable families (sending one is a 400).
// Haiku 4.5 / Sonnet 4.6 / Opus 4.6 still accept temperature.
const supportsTemperature = model => !/opus-5|opus-4-[789]|sonnet-5|fable|mythos/i.test(model);

/**
 * judge(input, options) -> Promise<contract response>
 *   input   : already-validated { cards, answers:[{name,answer}], spicy }
 *   options : { apiKey, model, mock, timeoutMs, fetch, noDelay } — all optional; apiKey/model/mock
 *             default from process.env when it exists (Node), so Workers can pass them explicitly.
 */
async function judge(input, options = {}) {
  const env = getEnv();
  const mock = options.mock ?? env.MOCK_AI === '1';
  if (mock) return mockJudge(input, options);

  const apiKey = options.apiKey ?? env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new JudgeError(500, 'Server is missing ANTHROPIC_API_KEY');
  const model = options.model || env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? LIMITS.TIMEOUT_MS;

  const prompts = buildPrompts(input);
  const request = {
    model,
    max_tokens: prompts.maxTokens,
    system: prompts.system,
    messages: [{ role: 'user', content: prompts.user }],
  };
  if (supportsTemperature(model)) request.temperature = prompts.temperature;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res, data;
  try {
    res = await doFetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    if (err && err.name === 'AbortError') throw new JudgeError(504, 'The Goose took too long — try again');
    throw new JudgeError(502, 'Could not reach the AI judge');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    console.error('[judge] anthropic error', res.status, msg); // never log the key
    if (res.status === 401 || res.status === 403) throw new JudgeError(500, 'AI key rejected — check ANTHROPIC_API_KEY');
    if (res.status === 402) throw new JudgeError(500, 'AI account has a billing problem — check console.anthropic.com');
    if (res.status === 404) throw new JudgeError(500, `AI model not available: ${model} — check ANTHROPIC_MODEL`);
    if (res.status === 400) throw new JudgeError(500, `AI request rejected: ${msg}`);
    if (res.status === 429) throw new JudgeError(429, 'AI judge is busy, try again in a moment');
    if (res.status === 529 || res.status >= 500) throw new JudgeError(503, 'AI judge is overloaded, try again');
    throw new JudgeError(502, 'AI judge error');
  }
  if (data.stop_reason === 'refusal') throw new JudgeError(502, 'AI judge declined this round');
  if (data.stop_reason === 'max_tokens') throw new JudgeError(502, 'AI judge ran out of words');

  const text = (Array.isArray(data.content) ? data.content : []).filter(b => b && b.type === 'text').map(b => b.text).join('');
  const parsed = extractJson(text);
  if (!parsed) throw new JudgeError(502, 'AI judge returned no JSON');
  return normalise(parsed, input, { model, mock: false });
}

/**
 * Transport-agnostic handler. Wrappers call this and just send status/body.
 *   method  : 'POST' etc.
 *   rawBody : string | object (already parsed)
 *   options : passed to judge()
 */
async function handleJudgeRequest({ method, rawBody, options } = {}) {
  try {
    if (method !== 'POST') throw new JudgeError(405, 'Use POST');
    let body = rawBody;
    if (typeof rawBody === 'string') {
      if (new TextEncoder().encode(rawBody).length > LIMITS.MAX_BODY_BYTES) throw new JudgeError(413, 'Request too large');
      try { body = JSON.parse(rawBody || '{}'); } catch { throw new JudgeError(400, 'Invalid JSON'); }
    }
    const result = await judge(validateRequest(body), options);
    return { status: 200, body: result };
  } catch (err) {
    const status = err instanceof JudgeError ? err.status : 500;
    if (status >= 500) console.error('[judge]', err && err.message ? err.message : err);
    return { status, body: { error: (err && err.message) || 'Unknown error' } };
  }
}

module.exports = {
  judge, imageUrl, validateRequest, handleJudgeRequest, JudgeError, LIMITS,
  buildPrompts, buildSinglePrompt, buildPartyPrompt, SYSTEM_PROMPT,
  extractJson, normalise, distinctScores, mockJudge, hash32,
  DEFAULT_MODEL, HITS, BADGES, LEVELS, GOOSE_TARGETS,
};
