async function testArcVideoFetch() {
  console.log('=== TESTING ARC PUBLISHING VIDEO FETCH ENDPOINTS ===');

  const articleUri = '/video/shows/market-call/2026/07/29/tim-regans-top-picks-brookfield-corp-allegion-plc-thomson-reuters/';
  const contentId = '3416829';

  const queries = [
    { resolver: 'video-by-id', query: { id: contentId } },
    { resolver: 'video-by-uri', query: { uri: articleUri } },
    { resolver: 'story-by-uri', query: { uri: articleUri } },
    { resolver: 'content-api-story-by-uri', query: { uri: articleUri } },
    { resolver: 'video-playlist-by-id', query: { id: contentId } },
  ];

  for (const q of queries) {
    const url = `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/${q.resolver}?query=${encodeURIComponent(JSON.stringify(q.query))}&d=222&_website=bnn-bloomberg`;
    console.log(`\nTesting resolver "${q.resolver}":`);
    console.log(`  URL: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });
      console.log(`  Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Response Data:`, JSON.stringify(data, null, 2).slice(0, 1500));
        const str = JSON.stringify(data);
        const streams = str.match(/https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|m4a|mp3)[^"'\s>]*/gi) || [];
        console.log(`  Found ${streams.length} stream URLs:`, streams);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

testArcVideoFetch();
