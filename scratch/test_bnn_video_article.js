async function testBnnVideoArticle() {
  console.log('=== TESTING BNN BLOOMBERG QUERYLY VIDEO ARTICLES ===');
  const QUERYLY_KEY = 'e5c9f131f6f04418';
  const queryUrl = `https://api.queryly.com/v1/search.aspx?queryly_key=${QUERYLY_KEY}&query=market%20call&endindex=10&batchsize=10`;

  try {
    const res = await fetch(queryUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Queryly Total Results:', data.totalresults);
      const items = data.items || [];
      for (const item of items) {
        console.log(`\nTitle: ${item.title}`);
        console.log(`Link: https://www.bnnbloomberg.ca${item.link}`);
        console.log(`PubDate: ${item.pubdate}`);
        console.log(`CNTV / Video ID: ${item.videoid || item.cnid || item._id}`);
      }

      // Fetch HTML of the first video article link
      if (items.length > 0) {
        const artUrl = `https://www.bnnbloomberg.ca${items[0].link}`;
        console.log(`\n=== FETCHING VIDEO ARTICLE HTML: ${artUrl} ===`);
        const artRes = await fetch(artUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        if (artRes.ok) {
          const html = await artRes.text();
          console.log(`Article HTML Length: ${html.length} bytes`);

          // Look for 9c99 CDN or 9c99.com, m3u8, mp4, or JSON data
          const mediaUrls = html.match(/https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|mp3|m4a)[^"'\s>]*/gi) || [];
          console.log(`Media URLs found (${mediaUrls.length}):`, mediaUrls.slice(0, 10));

          const jsonEmbeds = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
          console.log(`JSON-LD embeds found: ${jsonEmbeds.length}`);
          for (const j of jsonEmbeds) {
            console.log(j.slice(0, 300));
          }
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testBnnVideoArticle();
