// .netlify/functions/score.js
exports.handler = async (event) => {
  const payload = JSON.parse(event.body);
  const { cards, answer, imageOnly } = payload;   // <-- NEW

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

  const systemPrompt = `You are the snarky, pun-loving host of "Gaggle", styled after the New York Punderdome. 
Keep every reply short, hilarious, and in-character. 
Never break the three-line format.`;

  // -----------------------------------------------------------------
  // 1. Claude – always run (fast)
  // -----------------------------------------------------------------
  let score = 5, comment = 'AI took a nap.', aiCollective = 'a glitch';
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!claudeRes.ok) throw new Error(`Claude ${claudeRes.status}`);
    const claudeData = await claudeRes.json();
    const text = claudeData.content[0].text.trim();

    score = parseInt(text.match(/SCORE:\s*(\d+)/i)?.[1] ?? '5', 10);
    comment = text.match(/COMMENT:\s*(.+?)(?=COLLECTIVE:|$)/is)?.[1]?.trim() ?? 'Nice try!';
    aiCollective = text.match(/COLLECTIVE:\s*(.+?)(?:\n|$)/is)?.[1]?.trim() ?? 'a gaggle';
  } catch (e) {
    console.error('Claude error', e);
  }

  // -----------------------------------------------------------------
  // 2. If the caller only wants the image → skip Claude & return it
  // -----------------------------------------------------------------
  if (imageOnly) {
    const imagePrompt = `A funny, engaging illustration of ${cards.join(' ')} ${answer}, cartoon style, vibrant colors, whimsical scene`;
    console.log('DALL·E (imageOnly) Prompt:', imagePrompt);   // ← DEBUG

    try {
      console.log('OPENAI_API_KEY present?', !!process.env.OPENAI_API_KEY); // ← DEBUG

      const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: imagePrompt,
          size: '1024x1024',
          quality: 'standard',
          n: 1
        })
      });

      console.log('DALL·E (imageOnly) Status:', imgRes.status); // ← DEBUG
      console.log('DALL·E (imageOnly) Headers:', Object.fromEntries(imgRes.headers.entries())); // ← DEBUG

      let imageData;
      try {
        imageData = await imgRes.json();
      } catch (e) {
        console.error('DALL·E JSON parse failed:', e); // ← DEBUG
        imageData = { error: 'Invalid JSON' };
      }

      console.log('DALL·E (imageOnly) Response Body:', imageData); // ← DEBUG

      if (imgRes.ok && imageData.data?.[0]?.url) {
        console.log('DALL·E (imageOnly) Success! URL:', imageData.data[0].url); // ← DEBUG
        return { statusCode: 200, body: JSON.stringify({ imageUrl: imageData.data[0].url }) };
      } else {
        console.warn('DALL·E (imageOnly) failed:', imageData.error || imageData); // ← DEBUG
      }
    } catch (imgErr) {
      console.error('DALL·E (imageOnly) Exception:', imgErr.message); // ← DEBUG
    }
    return { statusCode: 200, body: JSON.stringify({ imageUrl: null }) };
  }

  // -----------------------------------------------------------------
  // 3. Normal flow – return Claude only
  // -----------------------------------------------------------------
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, comment, aiCollective, imageUrl: null })
    };
};