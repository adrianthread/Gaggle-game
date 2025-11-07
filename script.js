// ==== DECKS LOADED FROM JSON ====
const DECK_PATHS = {
  nouns: {
    animals: '/decks/nouns/animals.json',
    professions: '/decks/nouns/professions.json',
    'food-and-bev': '/decks/nouns/food-and-bev.json',
    objects: '/decks/nouns/objects.json',
    'sporting-athletes': '/decks/nouns/sporting-athletes.json',
    'fantasy-creatures': '/decks/nouns/fantasy-creatures.json'
  },
  scenarios: {
    'physical-settings': '/decks/scenarios/physical-settings.json',
    'emotional-states': '/decks/scenarios/emotional-states.json',
    'family-settings': '/decks/scenarios/family-settings.json',
    'social-gatherings': '/decks/scenarios/social-gatherings.json',
    'fantasy-settings': '/decks/scenarios/fantasy-settings.json',
    'historical-settings': '/decks/scenarios/historical-settings.json',
    'artistic-settings': '/decks/scenarios/artistic-settings.json',
    'natural-phenomenon': '/decks/scenarios/natural-phenomenon.json',
    'transportation-modes': '/decks/scenarios/transportation-modes.json',
    'weather-conditions': '/decks/scenarios/weather-conditions.json'
  }
};

let loadedDecks = { nouns: {}, scenarios: {} };
let selectedNounDeck = null;
let selectedScenarioDeck = null;

// ==== ELEMENTS ====
let cardArea, promptEl, answerInput, resultModal;
let gameModeSelect, nounDeckSelect, scenarioDeckSelect;
let nounDeckBox, scenarioDeckBox;

// ==== LOAD ALL DECKS ONCE ====
async function loadAllDecks() {
  const nounPromises = Object.entries(DECK_PATHS.nouns).map(async ([key, path]) => {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error();
      loadedDecks.nouns[key] = await res.json();
    } catch (e) {
      console.warn(`Failed to load noun deck: ${key}`);
      loadedDecks.nouns[key] = ['?'];
    }
  });

  const scenarioPromises = Object.entries(DECK_PATHS.scenarios).map(async ([key, path]) => {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error();
      loadedDecks.scenarios[key] = await res.json();
    } catch (e) {
      console.warn(`Failed to load scenario deck: ${key}`);
      loadedDecks.scenarios[key] = ['?'];
    }
  });

  await Promise.all([...nounPromises, ...scenarioPromises]);
}

// ==== POPULATE DECK SELECTORS ====
function populateDeckSelectors() {
  // Noun decks
  nounDeckSelect.innerHTML = '';
  Object.keys(loadedDecks.nouns).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = formatDeckName(key);
    nounDeckSelect.appendChild(opt);
  });
  selectedNounDeck = nounDeckSelect.value;

  // Scenario decks
  scenarioDeckSelect.innerHTML = '';
  Object.keys(loadedDecks.scenarios).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = formatDeckName(key);
    scenarioDeckSelect.appendChild(opt);
  });
  selectedScenarioDeck = scenarioDeckSelect.value;
}

function formatDeckName(key) {
  return key
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ==== HELPERS ====
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];

// ==== DRAW CARDS ====
function drawCards() {
  const mode = gameModeSelect.value;
  let drawn = [];

  if (mode === 'classic') {
    const deck = loadedDecks.nouns[selectedNounDeck];
    drawn = [randomItem(deck)];
  } else if (mode === 'scenarios') {
    const noun = randomItem(loadedDecks.nouns[selectedNounDeck]);
    const scenario = randomItem(loadedDecks.scenarios[selectedScenarioDeck]);
    drawn = [noun, scenario];
  }

  return drawn;
}

function renderCards(cards) {
  cardArea.innerHTML = '';
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card';
    const inner = document.createElement('div');
    inner.className = 'card-inner';
    const front = document.createElement('div');
    front.className = 'card-front';
    front.innerHTML = 'Card';
    const back = document.createElement('div');
    back.className = 'card-back';
    back.textContent = c;
    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    cardArea.appendChild(card);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => card.classList.add('flipped'));
    });
  });

  let promptText = `What do you call a gaggle of: ${cards[0]}?`;
  if (gameModeSelect.value === 'scenarios') {
    promptText = `What do you call a gaggle of: ${cards[0]} in a ${cards[1]}?`;
  }
  promptEl.textContent = promptText;
  promptEl.classList.remove('hidden');
}

// ==== DOM READY ====
document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  cardArea = document.getElementById('cardArea');
  promptEl = document.getElementById('prompt');
  answerInput = document.getElementById('answerInput');
  resultModal = document.getElementById('resultModal');
  gameModeSelect = document.getElementById('gameMode');
  nounDeckSelect = document.getElementById('nounDeckSelect');
  scenarioDeckSelect = document.getElementById('scenarioDeckSelect');
  nounDeckBox = document.getElementById('nounDeckBox');
  scenarioDeckBox = document.getElementById('scenarioDeckBox');

  // Load decks
  await loadAllDecks();
  populateDeckSelectors();

  // Update UI on mode change
  gameModeSelect.addEventListener('change', () => {
    const isScenarios = gameModeSelect.value === 'scenarios';
    scenarioDeckBox.classList.toggle('hidden', !isScenarios);
    cardArea.innerHTML = '';
    promptEl.classList.add('hidden');
    answerInput.value = '';
  });

  // Track selected decks
  nounDeckSelect.addEventListener('change', () => {
    selectedNounDeck = nounDeckSelect.value;
  });
  scenarioDeckSelect.addEventListener('change', () => {
    selectedScenarioDeck = scenarioDeckSelect.value;
  });

  // Close modal
  resultModal.addEventListener('click', e => {
    if (e.target === resultModal) resultModal.classList.add('hidden');
  });

  // Main interaction
  document.addEventListener('click', e => {
    if (e.target.id === 'drawBtn') {
      const cards = drawCards();
      renderCards(cards);
    }

    if (e.target.id === 'submitBtn') {
      const answer = answerInput.value.trim();
      if (!answer) return alert('Type something funny!');
      const cards = Array.from(document.querySelectorAll('.card-back')).map(el => el.textContent);

      fetch('/.netlify/functions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, answer })
      })
        .then(r => r.json())
        .then(data => {
          document.getElementById('scoreDisplay').textContent = `Score: ${data.score}/10`;
          document.getElementById('commentDisplay').textContent = data.comment;
          document.getElementById('punDisplay').querySelector('span').textContent = data.pun;
          resultModal.classList.remove('hidden');
          answerInput.value = '';
        })
        .catch(() => alert('AI is thinking… try again!'));
    }

    if (e.target.id === 'closeModal') {
      e.stopPropagation();
      resultModal.classList.add('hidden');
    }

    if (e.target.id === 'shareBtn') {
      e.stopPropagation();
      const text = `I got ${document.getElementById('scoreDisplay').textContent} in Gaggle! Play: ${location.href}`;
      if (navigator.share) {
        navigator.share({ text }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text).then(() => alert('Copied!'));
      }
    }
  });
});
