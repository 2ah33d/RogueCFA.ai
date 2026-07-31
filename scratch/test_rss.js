async function testRssFeeds() {
  const rssUrls = [
    'https://www.omnycontent.com/d/playlist/4809bc8a-e41a-405c-93da-a8cf011df2f4/fcfd42e4-d5c6-4b4a-8c62-ae32016f1b9a/4ecaf48c-23a4-4f5e-84b3-ae3201711923/podcast.rss',
    'https://www.bnnbloomberg.ca/feed/podcast/market-call',
    'https://www.bnnbloomberg.ca/investing/rss/',
  ];

  console.log('=== TESTING RSS FEEDS LIVE ===');
  for (const url of rssUrls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
      });
      console.log(`URL: ${url}`);
      console.log(`  HTTP Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Response Size: ${text.length} bytes`);
        const items = text.match(/<item>([\s\S]*?)<\/item>/gi) || [];
        console.log(`  Items Found: ${items.length}`);
        if (items.length > 0) {
          const title = (items[0].match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
          const pubDate = (items[0].match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1];
          console.log(`  Top Item Title: ${title}`);
          console.log(`  Top Item PubDate: ${pubDate}`);
        }
      }
    } catch (err) {
      console.log(`URL: ${url}`);
      console.log(`  Error: ${err.message}`);
    }
  }
}

testRssFeeds();
