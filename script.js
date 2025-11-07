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

    // CSP-safe flip animation
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
  await loadDecks(); // Wait for decks to load

  cardArea = document.getElementById('cardArea');
  promptEl = document.getElementById('prompt');
  answerInput = document.getElementById('answerInput');
  resultModal = document.getElementById('resultModal');
  gameModeSelect = document.getElementById('gameMode');

  // Close modal on background click
  resultModal.addEventListener('click', (e) => {
    if (e.target === resultModal) {
      resultModal.classList.add('hidden');
    }
  });

  // Main click handler
  document.addEventListener('click', (e) => {
    // Draw Cards
    if (e.target.id === 'drawBtn') {
      const cards = drawCards();
      renderCards(cards);
    }

    // Submit Answer
    if (e.target.id === 'submitBtn') {
      const answer = answerInput.value.trim();
      if (!answer) return alert('Type something funny!');
      const cards = Array.from(document.querySelectorAll('.card-back')).map(el => el.textContent);

      fetch('/.netlify/functions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, answer })
      })
        .then(res => res.json())
        .then(data => {
          document.getElementById('scoreDisplay').textContent = `Score: ${data.score}/10`;
          document.getElementById('commentDisplay').textContent = data.comment;
          document.getElementById('punDisplay').querySelector('span').textContent = data.pun;
          resultModal.classList.remove('hidden');
          answerInput.value = '';
        })
        .catch(() => alert('AI is thinking... try again!'));
    }

    // Close Modal
    if (e.target.id === 'closeModal') {
      e.stopPropagation();
      resultModal.classList.add('hidden');
    }

    // Share Score
    if (e.target.id === 'shareBtn') {
      e.stopPropagation();
      const text = `I got ${document.getElementById('scoreDisplay').textContent} in Gaggle! Play: ${location.href}`;
      if (navigator.share) {
        navigator.share({ text }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
      }
    }
  });

  // Reset on mode change
  gameModeSelect.addEventListener('change', () => {
    cardArea.innerHTML = '';
    promptEl.classList.add('hidden');
    answerInput.value = '';
  });
});
