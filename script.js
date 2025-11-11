// ==== DECK PATHS ====
const DECK_PATHS = {
  nouns: {
    animals: '/decks/nouns/animals.json',
    professions: '/decks/nouns/professions.json',
    'food-and-bev': '/decks/nouns/food-and-bev.json',
    'sporting-athletes': '/decks/nouns/sporting-athletes.json'
  },
  // Only ONE scenario deck
  scenarios: {
    'physical-settings': '/decks/scenarios/physical-settings.json'
  }
};

let loadedDecks = { nouns: {}, scenarios: {} };
let selectedNounDeck = null;
let decksLoaded = false;

// Fixed scenario deck (no selector)
const FIXED_SCENARIO_DECK = 'physical-settings';

// ==== ELEMENTS ====
let cardArea, promptEl, answerInput, resultModal;
let gameModeSelect, nounDeckSelect;
let nounDeckBox;

// ==== LOAD DECKS ====
async function loadAllDecks() {
  const promises = [];

  // Load all noun decks
  Object.entries(DECK_PATHS.nouns).forEach(([key, path]) => {
    promises.push(
      fetch(path)
        .then(r => r.json())
        .then(data => {
          loadedDecks.nouns[key] = data.filter(Boolean);
          if (loadedDecks.nouns[key].length === 0) loadedDecks.nouns[key] = ['?'];
        })
        .catch(err => {
          console.warn(`Failed to load noun deck: ${key}`, err);
          loadedDecks.nouns[key] = ['?'];
        })
    );
  });

  // Load ONLY the fixed scenario deck
  const scenarioPath = DECK_PATHS.scenarios[FIXED_SCENARIO_DECK];
  promises.push(
    fetch(scenarioPath)
      .then(r => r.json())
      .then(data => {
        loadedDecks.scenarios[FIXED_SCENARIO_DECK] = data.filter(Boolean);
        if (loadedDecks.scenarios[FIXED_SCENARIO_DECK].length === 0) {
          loadedDecks.scenarios[FIXED_SCENARIO_DECK] = ['?'];
        }
      })
      .catch(err => {
        console.warn(`Failed to load scenario deck: ${FIXED_SCENARIO_DECK}`, err);
        loadedDecks.scenarios[FIXED_SCENARIO_DECK] = ['?'];
      })
  );

  await Promise.all(promises);
  decksLoaded = true;
  console.log('All decks loaded');
}

// ==== POPULATE NOUN SELECTOR ONLY ====
function populateNounSelector() {
  nounDeckSelect.innerHTML = '';
  Object.keys(loadedDecks.nouns).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = formatName(key);
    nounDeckSelect.appendChild(opt);
  });
  selectedNounDeck = nounDeckSelect.value || Object.keys(loadedDecks.nouns)[0];
}

function formatName(key) {
  return key
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ==== HELPERS ====
const randomItem = arr => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : '?';

// ==== DRAW CARDS ====
function drawCards() {
  if (!decksLoaded) {
    alert('Decks still loading... try again!');
    return [];
  }

  const mode = gameModeSelect.value;
  let drawn = [];

  const nounDeck = loadedDecks.nouns[selectedNounDeck] || ['?'];
  const scenarioDeck = loadedDecks.scenarios[FIXED_SCENARIO_DECK] || ['?'];

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
    back.textContent = c;
    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    cardArea.appendChild(card);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => card.classList.add('flipped'));
    });
  });

  let prompt = `What do you call a gaggle of: ${cards[0]}?`;
  if (gameModeSelect.value === 'scenarios') {
    prompt = `What do you call a gaggle of: ${cards[0]} in a ${cards[1]}?`;
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
  nounDeckBox = document.getElementById('nounDeckBox');

  // Load decks
  await loadAllDecks();
  populateNounSelector();

  // Initial UI
  const isScenarios = gameModeSelect.value === 'scenarios';
  // No scenario box to show/hide

  // === EVENT LISTENERS ===
  gameModeSelect.addEventListener('change', () => {
    cardArea.innerHTML = '';
    promptEl.classList.add('hidden');
    answerInput.value = '';
  });

  nounDeckSelect.addEventListener('change', () => {
    selectedNounDeck = nounDeckSelect.value;
  });

  resultModal.addEventListener('click', e => {
    if (e.target === resultModal) resultModal.classList.add('hidden');
  });

  document.addEventListener('click', e => {
    if (e.target.id === 'drawBtn') {
      const cards = drawCards();
      if (cards.length) renderCards(cards);
    }

    if (e.target.id === 'submitBtn') {
      const answer = answerInput.value.trim();
      if (!answer) return alert('Type something funny!');
      const cards = Array.from(document.querySelectorAll('.card-back')).map(el => el.textContent);

      // Local mock server (for dev)
      fetch('http://localhost:8888/.netlify/functions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, answer })
      })
        .then(r => r.json())
        .then(data => {
          document.getElementById('scoreDisplay').textContent = `Score: ${data.score}/10`;
          document.getElementById('commentDisplay').textContent = data.comment;
          document.getElementById('aiCollectiveText').textContent = data.aiCollective;
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