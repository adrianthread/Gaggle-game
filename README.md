# 🪿 Gaggle

**The collective-noun party game, judged by an AI goose.**

Draw a noun card and a scenario card — *Penguins* at *A Funeral Service* — and invent the collective noun. *A tuxedo of penguins? A wake of penguins?* The Goose scores you out of 10, roasts your answer, enters its own rival phrase, and draws a picture of the winner.

Three ways to play:

- **Daily Gaggle** — the same card pair for everyone, once a day. Keep your streak.
- **Free play vs the Goose** — best of five against the bot.
- **Party (pass the phone)** — 2–8 players, one phone, three rounds, a champion.

No accounts, no app store, no build step. One Node file on a laptop and everyone's phones on the same Wi-Fi.

---

## Play at home in 2 minutes

You need [Node 22+](https://nodejs.org) and an Anthropic API key from [console.anthropic.com](https://console.anthropic.com) → API Keys.

```bash
git clone https://github.com/<you>/Gaggle-game.git
cd Gaggle-game
cp .env.example .env          # then paste your key into .env
npm start
```

The console prints two URLs:

```
🪿 Gaggle (model claude-haiku-4-5-20251001)
  Local:   http://localhost:3000
  Phones:  http://192.168.1.23:3000   ← same Wi-Fi
```

Type the **Phones** URL into each phone's browser. That's it — only the laptop holds the key; phones just load a web page.

**If phones can't connect:**
- First run on macOS/Windows pops a firewall prompt — click *Allow* (Windows: tick *Private networks*).
- Guest / hotel Wi-Fi often has "client isolation", which blocks phone → laptop. Use your home network or the laptop's own hotspot.
- Keep the laptop awake.
- Different port: `PORT=8080 npm start`.

### No key yet?

```bash
npm run mock
```

Runs a fake judge with realistic, varied scores (distinct in party mode, plausible bot answers, real pictures). Every screen works; nothing costs anything. The response carries `"mock": true` so you can't mistake it for the real Goose.

### Play from your phone when you're away from the laptop

`npm start` only reaches phones on the same Wi-Fi. To play from anywhere while the laptop stays on, open a free tunnel next to it (no account needed):

```bash
# terminal 1
npm start

# terminal 2 — Cloudflare quick tunnel
npx --yes cloudflared tunnel --url http://localhost:3000
```

It prints a URL like `https://random-words.trycloudflare.com` — open that on your phone. Notes: the URL changes every time you start the tunnel (re-share it), the laptop must stay awake, and because it's `https` the phone's native Share sheet works too. Prefer a permanent `cloudflared` install? `brew install cloudflared` (macOS) or `winget install Cloudflare.cloudflared` (Windows), then the same `cloudflared tunnel --url http://localhost:3000`.

If you'd rather not keep a laptop on, deploy once to Vercel (next section) and it's always up.

---

## Deploy for free (play from anywhere)

Hosting is $0 on all of these; you only pay Anthropic per round (see [Cost](#cost)). Set `ANTHROPIC_API_KEY` in the host's dashboard — never commit it.

**Vercel (recommended).** Push to GitHub → [vercel.com](https://vercel.com) → *Add New Project* → import the repo → Framework preset *Other*, leave build command and output directory blank → *Environment Variables*: `ANTHROPIC_API_KEY` → Deploy. Vercel serves the repo root as static and turns `api/judge.js` into `/api/judge`. `vercel.json` sets a 30 s function budget and the CSP.

**Netlify (free Starter tier is fine).** Import the repo; `netlify.toml` already publishes the root, packages `netlify/functions/judge.js`, and rewrites `/api/*` to it. *Site settings → Environment variables* → add `ANTHROPIC_API_KEY`. Netlify's synchronous function limit is 10 s by default (not configurable in `netlify.toml`); Haiku usually answers in 2–5 s, so a `502` from Netlify means Anthropic was unusually slow — just play the round again.

**Cloudflare Pages.** Works, but Pages Functions use a different handler syntax (`functions/api/judge.js` exporting `onRequestPost`) — a ten-line wrapper around `lib/judge.js`'s `handleJudgeRequest`, passing `env.ANTHROPIC_API_KEY` in `options`. Not shipped in the repo.

Check any deploy with `curl -i https://<your-site>/api/judge` — a `405 {"error":"Use POST"}` proves the route reaches the function.

---

## How it works

```
Browser (index.html / script.js / style.css / decks/*.json)
   │  POST /api/judge  {cards, answers:[{name,answer}], spicy}
   │  <img src="https://image.pollinations.ai/prompt/...">     (direct, no server)
   ▼
One transport wrapper per host
   ├─ server.js                  laptop / LAN (static files + /api/judge)
   ├─ netlify/functions/judge.js Netlify (via /api/* redirect)
   └─ api/judge.js               Vercel
   ▼
lib/judge.js  — the only file that knows about Anthropic and Pollinations
   validate → build prompt (single or party) → Claude → parse/normalise → attach imageUrl
```

- **The browser never sees the key.** The page only ever calls `/api/judge` on its own origin (CSP `connect-src 'self'`). The server adds the key and talks to Anthropic.
- **One judge call per round**, even with 8 players — the party prompt ranks everyone at once and the server guarantees distinct scores.
- **Pictures come from [Pollinations](https://pollinations.ai)** — free, no key. The judge returns a literal `image_idea` ("penguins in tiny tuxedos weeping at a graveside"); the server turns it into one seeded URL per round and the browser loads it straight into an `<img>`. If Pollinations is slow the game carries on without it.
- **Mock mode** (`--mock` / `MOCK_AI=1`) never touches the network.

## Cost

The default model is Claude Haiku 4.5 (`claude-haiku-4-5-20251001`): $1 per million input tokens, $5 per million output. A round is roughly 1,000 input + 200 output tokens ≈ **0.2¢**. A $5 top-up is about 2,500 rounds. Set `ANTHROPIC_MODEL` to try a different model.

---

## API

`POST /api/judge` — same on every host. Handy if you want to build a scoreboard or a Discord bot.

Request:

```json
{ "cards": ["Penguins", "At a Funeral Service"],
  "answers": [ {"name":"Ade","answer":"a tuxedo of penguins"}, {"name":"Mum","answer":"a wake of penguins"} ],
  "spicy": false }
```

- `cards`: `[noun, scenario]` (strings ≤ 60 chars; 1–3 accepted).
- `answers`: 1–8 entries. `name` ≤ 24 chars (defaults to `Player N`, duplicates get a suffix). `answer` ≤ 80 chars and **may be empty** — party players can skip.
- `spicy`: boolean, default `false`. PG-13 cheek when true.
- Body ≤ 16 KB.

Response `200`:

```json
{
  "results": [
    { "name":"Ade", "answer":"a tuxedo of penguins", "hits":["image"], "score":6,
      "verdict":"Dressed For The Wrong Room", "comment":"...", "badge":"wholesome" },
    { "name":"Mum", "answer":"a wake of penguins", "hits":["pun","sound","scenario","image"], "score":10,
      "verdict":"Honk Of The Century", "comment":"...", "badge":"wordsmith" }
  ],
  "winner": "Mum",
  "bot": { "answer": "a pallbearing of penguins", "score": 8 },
  "imageUrl": "https://image.pollinations.ai/prompt/...?width=512&height=512&nologo=true&seed=1234",
  "model": "claude-haiku-4-5-20251001",
  "mock": false
}
```

- `results` in request order, names copied exactly. `hits` ⊆ `pun | sound | scenario | image`; `score` 1–10 (distinct across players when there are 2+); `verdict` ≤ 40 chars; `comment` ≤ 160; `badge` ∈ `groaner | wordsmith | poet | chaos | wholesome | lazy | filthy`.
- `winner` is the top-scoring *player* (never the bot). `bot` is the Goose's own entry and honest self-score.
- `imageUrl` is one per round, for the better of winner vs bot, with a deterministic seed.

Errors return `{ "error": "message" }` with `400` bad input, `405` wrong method, `413` too large, `429` busy, `500` key missing/rejected, `502` the AI returned garbage, `503` overloaded, `504` timeout.

---

## Decks

Cards live in `decks/nouns/*.json` and `decks/scenarios/*.json` — plain JSON arrays of strings. Add a file, or add lines to one; the front end loads every deck on start. Nouns are plural everyday things ("Penguins", "Bakers"); scenarios are settings ("At an Ice Rink"). The judge is told to ignore spelling quirks on cards, but tidy is nicer.

## Development

```bash
npm test          # node --test — no key, no network, ~1 s
npm run mock      # play the whole game against the fake judge
```

| File | Role |
|---|---|
| `lib/judge.js` | The brain: validation, **the judge prompt** (`SYSTEM_PROMPT`, `buildSinglePrompt`, `buildPartyPrompt`), the Anthropic call, parsing/normalising, mock mode, Pollinations URL. Zero deps, CommonJS. |
| `server.js` | Laptop/LAN server: static files (with traversal guard + CSP), `POST /api/judge`, rate limit, `.env` loader, `--mock`. |
| `netlify/functions/judge.js`, `api/judge.js` | ~15-line transport wrappers for Netlify and Vercel. No logic. |
| `netlify.toml`, `vercel.json` | Function config, `/api/*` routing, CSP headers. |
| `index.html`, `script.js`, `style.css`, `decks/` | The game. |
| `test/smoke.test.js` | Server + contract + parser tests. |

To change how the Goose judges, edit the prompt in `lib/judge.js`. Keep the JSON shape it asks for (`hits`, `score`, `verdict`, `comment`, `badge`, `bot_answer`, `bot_score`, `image_idea`) or update `normalise()` alongside it. Model responses are parsed tolerantly (fences, stray prose, missing players, out-of-range scores), so a slightly off reply degrades gracefully instead of failing the round.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing ANTHROPIC_API_KEY` on start | Create `.env` from `.env.example`, or `npm run mock`. |
| `500 AI key rejected` | Key is wrong/revoked, or has no credit. Check console.anthropic.com. |
| `500 AI model not available` | `ANTHROPIC_MODEL` names a model your account can't use. Unset it. |
| `504` timeout / `503` overloaded | Anthropic is slow or busy. Just play the round again. |
| Picture never loads | Pollinations is slow or rate-limited. The scores are already in; the picture is a bonus. |
| Phone says "can't connect" | Firewall prompt, guest Wi-Fi isolation, or laptop asleep — see *Play at home*. |
| Share button does nothing on LAN | `http://192.168…` isn't a secure context, so the browser hides the share API; the game falls back to copying the text. |
