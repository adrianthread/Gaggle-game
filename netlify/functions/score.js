// .netlify/functions/score.js
exports.handler = async (event) => {
  const { cards, answer } = JSON.parse(event.body);
  const noun = cards[0];
  const scenario = cards[1] || '';

  // ──────────────────────  USER PROMPT  ──────────────────────
  const userPrompt = `Cards drawn: ${cards.join(', ')}
Player answer: "${answer}"

${scenario ? 'Create a connection between the noun and the scenario.' : ''}

Rate 1–10 (relevance, wordplay, absurdity, cleverness) and give:
- One score
- One funny sentence commentary
- One creative collective-noun guess (1-2 words only)

Format **exactly**:
SCORE: X/10
COMMENT: <funny line>
COLLECTIVE: <your guess>`;

  // ──────────────────────  SYSTEM PROMPT  ──────────────────────
  const systemPrompt = `You are the snarky, pun-loving host of "Gaggle", styled after the New York Punderdome. 
Keep every reply short, hilarious, and in-character. 
Never break the three-line format.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 180,
        temperature: 0.9,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Anthropic error:', txt);
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.content[0].text.trim();

    // ────────  ROBUST PARSING  ────────
    const score = parseInt(text.match(/SCORE:\s*(\d+)/i)?.[1] ?? '5', 10);
    const comment = text.match(/COMMENT:\s*(.+?)(?=COLLECTIVE:|$)/is)?.[1]?.trim() ?? 'Nice try!';
    const aiCollective = text.match(/COLLECTIVE:\s*(.+?)(?:\n|$)/is)?.[1]?.trim() ?? 'a gaggle';

    const imagePrompt = `A funny, engaging illustration of ${cards.join(' ')} ${answer}, cartoon style, vibrant colors, whimsical scene`;

    // ---- DALL·E IMAGE GENERATION ----
    //https://grok.com/share/c2hhcmQtMi1jb3B5_ce55565e-512b-4275-acaa-03917bdbd53f
    const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        size: '1024x1024', // Small for cost
        quality: 'standard',
        n: 1
      })
    });

    const imageData = await imageRes.json();
    const imageUrl = imageData.data[0].url; // Or b64_json for base64

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, comment, aiCollective, imageURL }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        score: 1,
        comment: 'AI took a nap.',
        aiCollective: 'a glitch',
      }),
    };
  }
};