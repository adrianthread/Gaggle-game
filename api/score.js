// api/score.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { cards, answer } = req.body;
  if (!cards || !answer) return res.status(400).json({ error: 'Missing data' });

  const prompt = `You are a witty game show host for "Gaggle".

Cards drawn: ${cards.join(', ')}  
Player answer: "${answer}"

Rate the answer on a scale of 1–10 for:
1. Relevance to the cards  
2. Wordplay / Puns  
3. Absurdity / Surprise  
4. Cleverness

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

    const data = await response.json();
    const text = data.content[0].text;

    const score = text.match(/SCORE: (\d+)\/10/)?.[1] || '5';
    const comment = text.match(/COMMENT: (.*)/)?.[1] || 'Nice try!';
    const pun = text.match(/PUN: (.*)/)?.[1] || 'No pun intended.';

    res.json({ score: parseInt(score), comment, pun });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI failed' });
  }
};