// ==== DECK PATHS ====
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
let selectedNounDeck = 'professions'; // default
let selectedScenarioDeck = 'artistic-settings'; // default
let decksLoaded = false;

// ==== ELEMENTS ====
let cardArea, promptEl, answerInput, resultModal;
let gameModeSelect, nounDeckSelect, scenarioDeckSelect;
let nounDeckBox, scenarioDeckBox;

// ==== LOAD DECKS ====
async function loadAllDecks() {
  const promises = [];

  Object.entries(DECK_PATHS.nouns).forEach(([key, path]) => {
    promises.push(
      fetch(path)
        .then(r => r.json())
        .then(data => { loadedDecks.nouns[key] = data; })
        .catch(() => { loadedDecks.nouns[key] = ['?']; })
    );
  });

  Object.entries(DECK_PATHS.scenarios).forEach(([key, path]) => {
    promises.push(
      fetch(path)
        .then(r => r.json())
        .then(data => { loadedDecks.scenarios[key] = data; })
        .catch(() => { loadedDecks.scenarios[key] = ['?']; })
    );
  });

  await Promise.all(promises);
  decksLoaded = true;
  console.log('All decks loaded');
}

// ==== POPULATE SELECTORS ====
function populateSelectors() {
  nounDeckSelect.innerHTML = '';
  Object.keys(loadedDecks.nouns).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (key === selectedNounDeck) opt.selected = true;
    nounDeckSelect.appendChild(opt);
  });

  scenarioDeckSelect.innerHTML = '';
  Object.keys(loadedDecks.scenarios).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (key === selectedScenarioDeck) opt.selected = true;
    scenarioDeckSelect.appendChild(opt);
  });
}

// ==== HELPERS ====
const randomItem = arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : '?';

// ==== DRAW CARDS ====
function drawCards() {
  if (!decksLoaded) {
    alert('Decks still loading... try again in a sec!');
    return [];
  }

  const mode = gameModeSelect.value;
  let drawn = [];

  const nounDeck = loadedDecks.nouns[selectedNounDeck] || ['?'];
  const scenarioDeck = loadedDecks.scenarios[selectedScenarioDeck] || ['?'];

  if (mode === 'classic') {
    drawn = [randomItem(nounDeck)];
  } else {
    drawn = [randomItem(nounDeck), randomItem(scenarioDeck)];
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
    back.textContent = c || '?';
    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    cardArea.appendChild(card);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => card.classList.add('flipped'));
    });
  });

  let prompt = 'What do you call a gaggle of: ' + (cards[0] || '?') + '?';
  if (gameModeSelect.value === 'scenarios') {
    prompt = 'What do you call a gaggle of: ' + (cards[0] || '?') + ' in a ' + (cards[1] || '?') + '?';
  }
  promptEl.textContent = prompt;
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
  populateSelectors();

  // Initial UI state — HIDE SCENARIO DECK IF CLASSIC
  const isScenarios = gameModeSelect.value === 'scenarios';
  scenarioDeckBox.classList.toggle('hidden', !isScenarios);

  // Mode change
  gameModeSelect.addEventListener('change', () => {
    const isScenarios = gameModeSelect.value === 'scenarios';
    scenarioDeckBox.classList.toggle('hidden', !isScenarios);
    cardArea.innerHTML = '';
    promptEl.classList.add('hidden');
    answerInput.value = '';
  });

  // Deck change
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
      if (cards.length) renderCards(cards);
    }

    if (e.target.id === 'submitBtn') {
      const answer = answerInput.value.trim();
      if (!answer) return alert('Type something funny!');
      const cards = Array.from(document.querySelectorAll('.card-back')).map(el => el.textContent).filter(Boolean);

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
