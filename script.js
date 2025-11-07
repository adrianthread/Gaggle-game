// ==== DECKS LOADED FROM JSON ====
let nounsDeck = [];
let scenariosDeck = [];

// ==== ELEMENTS ====
let cardArea, promptEl, answerInput, resultModal, gameModeSelect;

// ==== LOAD DECKS ===
async function loadDecks() {
  try {
    const [nounsRes, scenariosRes] = await Promise.all([
      fetch('/decks/nouns.json'),
      fetch('/decks/scenarios.json')
    ]);
    nounsDeck = await nounsRes.json();
    scenariosDeck = await scenariosRes.json();
  } catch (err) {
    console.error('Failed to load decks:', err);
    alert('Decks failed to load. Check console.');
  }
}

// ==== HELPERS ====
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];

// ==== DRAW CARDS ====
function drawCards() {
  const mode = gameModeSelect.value;
  let drawn = [];

  if (mode === 'classic') {
    drawn = [randomItem(nounsDeck)];
  } else if (mode === 'scenarios') {
    const noun = randomItem(nounsDeck);
    const scenario = randomItem(scenariosDeck);
    drawn = [noun, scenario];
  }

  return drawn;
}

// ... rest of your script.js (renderCards, DOMContentLoaded, etc.) stays the same
