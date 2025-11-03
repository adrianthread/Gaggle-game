// ==== DECKS ====
const decks = {
  occupations: { name: "Occupations", icon: "Briefcase", items: ["programmers","chefs","astronauts","baristas","librarians","detectives","pilots","florists","mechanics","teachers"] },
  animals:     { name: "Animals",     icon: "Paw", items: ["penguins","sloths","octopuses","flamingos","capybaras","narwhals","platypuses","kangaroos","lemurs","axolotls"] },
  actions:     { name: "Actions",     icon: "Lightning", items: ["coding","dancing","juggling","singing","painting","skateboarding","cooking","photographing","gaming","yodeling"] },
  adjectives:  { name: "Adjectives",  icon: "Sparkles", items: ["caffeinated","nocturnal","sarcastic","overworked","clumsy","zen","hyperactive","melodramatic","stealthy","flamboyant"] }
};

// ==== HELPERS ====
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
const randomDecks = (min=1, max=3) => {
  const keys = Object.keys(decks);
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  return keys.sort(() => 0.5 - Math.random()).slice(0, count);
};

// ==== ELEMENTS ====
const cardArea = document.getElementById('cardArea');
const promptEl = document.getElementById('prompt');
const answerInput = document.getElementById('answerInput');
const resultModal = document.getElementById('resultModal');
const lbModal = document.getElementById('leaderboardModal');

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
  cardArea.innerHTML = '';
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">${c.icon}<br><small>${c.deckName}</small></div>
        <div class="card-back">${c.word}</div>
      </div>`;
    cardArea.appendChild(card);
    setTimeout(() => card.classList.add('flipped'), 300);
  });

  const words = cards.map(c => c.word).join(' ');
  promptEl.textContent = `What do you call a gaggle of: ${words}?`;
  promptEl.classList.remove('hidden');
}

// ==== DOM READY - ALL EVENT LISTENERS ====
document.addEventListener('DOMContentLoaded', () => {
  const drawBtn = document.getElementById('drawBtn');
  const submitBtn = document.getElementById('submitBtn');
  const leaderboardBtn = document.getElementById('leaderboardBtn');
  const closeModal = document.getElementById('closeModal');
  const closeLb = document.getElementById('closeLb');
  const shareBtn = document.getElementById('shareBtn');

  // DRAW CARDS
  drawBtn.addEventListener('click', () => {
    const cards = drawCards();
    renderCards(cards);
  });

  // SUBMIT ANSWER
  submitBtn.addEventListener('click', async () => {
    const answer = answerInput.value.trim();
    if (!answer) return alert('Type something funny!');

    const cards = Array.from(document.querySelectorAll('.card-back')).map(el => el.textContent);

    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, answer })
      });
      const data = await res.json();

      document.getElementById('scoreDisplay').textContent = `Score: ${data.score}/10`;
      document.getElementById('commentDisplay').textContent = data.comment;
      document.getElementById('punDisplay').querySelector('span').textContent = data.pun;
      resultModal.classList.remove('hidden');

      // Save to leaderboard
      const lb = JSON.parse(localStorage.getItem('gaggle_lb') || '[]');
      lb.push({ answer, score: data.score, date: new Date().toLocaleDateString() });
      lb.sort((a, b) => b.score - a.score);
      localStorage.setItem('gaggle_lb', JSON.stringify(lb.slice(0, 50)));

      answerInput.value = '';
    } catch (err) {
      alert('AI is thinking... try again!');
    }
  });

  // CLOSE MODALS
  closeModal.addEventListener('click', () => resultModal.classList.add('hidden'));
  closeLb.addEventListener('click', () => lbModal.classList.add('hidden'));

  // SHARE
  shareBtn.addEventListener('click', () => {
    const text = `I got ${document.getElementById('scoreDisplay').textContent} in Gaggle! Play: ${location.href}`;
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Score copied to clipboard!');
    }
  });

  // LEADERBOARD
  leaderboardBtn.addEventListener('click', () => {
    const lb = JSON.parse(localStorage.getItem('gaggle_lb') || '[]');
    const list = document.getElementById('lbList');
    list.innerHTML = lb.length === 0
      ? '<li><em>No scores yet — be the first!</em></li>'
      : lb.slice(0, 10).map(e => `<li><strong>${e.score}/10</strong> – ${e.answer}</li>`).join('');
    lbModal.classList.remove('hidden');
  });
});
