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
      const errorText = await response.text();
      console.error('Anthropic API Error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content[0].text;

    // DEBUG: LOG RAW AI RESPONSE
    console.log('=== RAW AI RESPONSE ===');
    console.log(rawText);
    console.log('=== END RAW ===');

    // Try to parse
    let score = 5;
    let comment = "Not bad, but I've seen better!";
    let pun = "No pun in ten did!";

    const scoreMatch = rawText.match(/SCORE:\s*(\d+)/i);
    if (scoreMatch) score = parseInt(scoreMatch[1]);

    const commentMatch = rawText.match(/COMMENT:\s*(.+?)(?=PUN:|$)/is);
    if (commentMatch) comment = commentMatch[1].trim();

    const punMatch = rawText.match(/PUN:\s*(.+)/is);
    if (punMatch) pun = punMatch[1].trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, comment, pun, debug: rawText }) // SEND RAW BACK
    };
  } catch (err) {
    console.error('Function Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        score: 1, 
        comment: "AI crashed.", 
        pun: "Error 500: Pun not found.",
        debug: err.message 
      })
    };
  }
};
