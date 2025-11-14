// .netlify/functions/generate-image.js
exports.handler = async (event) => {
    const { prompt } = JSON.parse(event.body);
  
    console.log('DALL·E Prompt (separate function):', prompt); // ← DEBUG
  
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          size: '1024x1024',
          quality: 'standard',
          n: 1
        })
      });
  
      console.log('DALL·E Status:', res.status);
      const data = await res.json();
      console.log('DALL·E Response:', data);
  
      if (res.ok && data.data?.[0]?.url) {
        return { statusCode: 200, body: JSON.stringify({ imageUrl: data.data[0].url }) };
      }
    } catch (err) {
      console.error('DALL·E Error:', err);
    }
  
    return { statusCode: 200, body: JSON.stringify({ imageUrl: null }) };
  };