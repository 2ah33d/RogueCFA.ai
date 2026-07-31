async function testBnnWebPlayerScraper() {
  console.log('=== INSPECTING BNN BLOOMBERG WEB PLAYER & QUERYLY ===');
  const QUERYLY_KEY = 'e5c9f131f6f04418';
  const searchUrl = `https://api.queryly.com/v1/search.aspx?queryly_key=${QUERYLY_KEY}&query=market%20call&endindex=10&batchsize=10`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
      },
    });

    const text = await res.text();
    console.log('Queryly Response Status:', res.status);
    console.log('Response Snippet:', text.slice(0, 300));

    try {
      const data = JSON.parse(text);
      console.log(`\nFound ${data.items?.length || 0} Queryly MarketCall items:`);
      for (const item of (data.items || []).slice(0, 5)) {
        console.log(`\nTitle: ${item.title}`);
        console.log(`Link: https://www.bnnbloomberg.ca${item.link}`);
        console.log(`PubDate: ${item.pubdate}`);
        console.log(`Summary: ${item.description || item.summary || 'N/A'}`);
      }
    } catch {
      console.log('Response was HTML/Text rather than JSON');
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testBnnWebPlayerScraper();
