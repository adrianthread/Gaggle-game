const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { cards, answer } = JSON.parse(event.body);
  if (!cards || !answer) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };
  }

  const prompt = `You are a witty game show host for "Gaggle".

Cards drawn: ${cards.join(', ')}  
Player answer: "${answer}"

Rate the answer on a scale of 1–10 for relevance, wordplay, absurdity, cleverness.
Give:
- A single score (average of above)
- 1-sentence funny commentary
- 1 punny comeback as the AI host

Format exactly:
SCORE: X/10
COMMENT: [funny line]
PUN: [AI pun]`;

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
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    // === ROBUST PARSING ===
    let score = 5;
    let comment = "Not bad, but I've seen better!";
    let pun = "No pun in ten did!";

    // Extract score
    const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
    if (scoreMatch) score = parseInt(scoreMatch[1]);

    // Extract comment
    const commentMatch = text.match(/COMMENT:\s*(.+?)(?=PUN:|$)/is);
    if (commentMatch) comment = commentMatch[1].trim();

    // Extract pun
    const punMatch = text.match(/PUN:\s*(.+)/is);
    if (punMatch) pun = punMatch[1].trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, comment, pun })
    };
  } catch (err) {
    console.error('AI Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        score: 1, 
        comment: "AI had a brain fart.", 
        pun: "Error 404: Pun not found." 
      })
    };
  }
};
