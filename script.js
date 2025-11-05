// ==== DECKS ====
const decks = {
  occupations: { name: "Occupations", icon: "💼", items: ["programmers","chefs","astronauts","baristas","librarians","detectives","pilots","florists","mechanics","teachers"] },
  animals:     { name: "Animals",     icon: "🐾", items: ["penguins","sloths","octopuses","flamingos","capybaras","narwhals","platypuses","kangaroos","lemurs","axolotls"] },
  actions:     { name: "Actions",     icon: "⚡", items: ["coding","dancing","juggling","singing","painting","skateboarding","cooking","photographing","gaming","yodeling"] },
  adjectives:  { name: "Adjectives",  icon: "✨", items: ["caffeinated","nocturnal","sarcastic","overworked","clumsy","zen","hyperactive","melodramatic","stealthy","flamboyant"] }
};

// ==== HELPERS ====
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
const randomDecks = (min=1, max=3) => {
  const keys = Object.keys(decks);
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  return keys.sort(() => 0.5 - Math.random()).slice(0, count);
};

// ==== ELEMENTS ====
let cardArea, promptEl, answerInput, resultModal;

// ==== DRAW CARDS ====
function drawCards() {
  const chosenKeys = randomDecks();
  const cards = chosenKeys.map(key => {
    const deck = decks[key];
    return { deckKey: key, deckName: deck.name, icon: deck.icon, word: randomItem(deck.items) };
  });
  return cards;
}

function renderCards(cards) {
  cardArea.innerHTML = ''; // OK to clear
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card';

    const cardInner = document.createElement('div');
    cardInner.className = 'card-inner';

    const cardFront = document.createElement('div');
    cardFront.className = 'card-front';

    const iconSpan = document.createElement('div');
    iconSpan.textContent = c.icon;
    iconSpan.style.fontSize = '2.5rem';
    iconSpan.style.marginBottom = '0.5rem';

    const label = document.createElement('small');
    label.textContent = c.deckName;

    cardFront.appendChild(iconSpan);
    cardFront.appendChild(label);

    const cardBack = document.createElement('div');
    cardBack.className = 'card-back';
    cardBack.textContent = c.word;

    cardInner.appendChild(cardFront);
    cardInner.appendChild(cardBack);
    card.appendChild(cardInner);
    cardArea.appendChild(card);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => card.classList.add('flipped'));
    });
  });

  const words = cards.map(c => c.word).join(' ');
  promptEl.textContent = `What do you call a gaggle of: ${words}?`;
  promptEl.classList.remove('hidden');
}

// ==== DOM READY ====
document.addEventListener('DOMContentLoaded', () => {
  cardArea = document.getElementById('cardArea');
  promptEl = document.getElementById('prompt');
  answerInput = document.getElementById('answerInput');
  resultModal = document.getElementById('resultModal');

  document.addEventListener('click', (e) => {
    if (e.target.id === 'drawBtn') {
      const cards = drawCards();
      renderCards(cards);
    }

    if (e.target.id === 'submitBtn') {
      const answer = answerInput.value.trim();
      if (!answer) return alert('Type something funny!');
      const cards = Array.from(document.querySelectorAll('.card-back')).map(el => el.textContent);

      fetch(''/.netlify/functions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, answer })
      })
        .then(res => res.json())
        .then(data => {
          document.getElementById('scoreDisplay').textContent = 'Score: ' + data.score + '/10';
          document.getElementById('commentDisplay').textContent = data.comment;
          document.getElementById('punDisplay').querySelector('span').textContent = data.pun;
          resultModal.classList.remove('hidden');

          // Save score (local only, no leaderboard)
          const scores = JSON.parse(localStorage.getItem('gaggle_scores') || '[]');
          scores.push({ answer, score: data.score, date: new Date().toLocaleDateString() });
          localStorage.setItem('gaggle_scores', JSON.stringify(scores.slice(-10))); // Top 10

          answerInput.value = '';
        })
        .catch(err => alert('AI is thinking... try again!'));
    }

    if (e.target.id === 'closeModal') {
      e.stopPropagation();
      resultModal.classList.add('hidden');
    }

    if (e.target.id === 'shareBtn') {
      e.stopPropagation();
      const scoreText = document.getElementById('scoreDisplay').textContent;
      const text = 'I got ' + scoreText + ' in Gaggle! Play: ' + location.href;
      if (navigator.share) {
        navigator.share({ text });
      } else {
        navigator.clipboard.writeText(text).then(() => alert('Score copied!'));
      }
    }
  });
});
