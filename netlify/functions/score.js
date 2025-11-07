// NO require('node-fetch') — use native fetch!

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let cards, answer;
  try {
    ({ cards, answer } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!cards || !answer) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };
  }

  const prompt = `You are a witty game show host for "Gaggle". Style yourself on hosts at the New York competition 'Punderdome'.
Cards drawn: ${cards.join(', ')}  
Player answer: "${answer}"

If there's more than one card, the collective noun should create a connection between them.

Rate 1–10 on relevance, wordplay, absurdity, cleverness.
Give:
- A single score
- 1-sentence funny commentary
- Your creative and punny attempt to make a collective noun for the drawn cards

Format exactly:
SCORE: X/10
COMMENT: [funny line]
Your answer: [AI collective noun]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.content[0].text;

    // Robust parsing
    const score = parseInt(text.match(/SCORE:\s*(\d+)/i)?.[1] || '5');
    const comment = text.match(/COMMENT:\s*(.+?)(?=PUN:|$)/is)?.[1]?.trim() || "Solid effort!";
    const pun = text.match(/PUN:\s*(.+)/is)?.[1]?.trim() || "Pun not found.";

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, comment, pun })
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        score: 1,
        comment: "AI took a nap.",
        pun: "Error 500: Wit not found."
      })
    };
  }
};
