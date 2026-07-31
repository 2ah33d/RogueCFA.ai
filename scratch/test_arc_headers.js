async function testArcHeaders() {
  console.log('=== TESTING ARC PUBLISHING API WITH ARC-SITE HEADERS ===');
  const articleUri = '/video/shows/market-call/2026/07/29/tim-regans-top-picks-brookfield-corp-allegion-plc-thomson-reuters/';

  const endpoints = [
    `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/story-by-uri?query=${encodeURIComponent(JSON.stringify({ uri: articleUri }))}&d=255&_website=bnn-bloomberg`,
    `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/video-by-uri?query=${encodeURIComponent(JSON.stringify({ uri: articleUri }))}&d=255&_website=bnn-bloomberg`,
    `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/content-api-story-by-uri?query=${encodeURIComponent(JSON.stringify({ uri: articleUri }))}&d=255&_website=bnn-bloomberg`,
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting: ${ep}`);
    try {
      const res = await fetch(ep, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Arc-Site': 'bnn-bloomberg',
          'Referer': 'https://www.bnnbloomberg.ca/',
        },
      });

      console.log('  Status:', res.status, res.statusText);
      if (res.ok) {
        const data = await res.json();
        console.log('  Response Data:', JSON.stringify(data, null, 2).slice(0, 1500));
        const str = JSON.stringify(data);
        const streams = str.match(/https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|m4a|mp3)[^"'\s>]*/gi) || [];
        console.log(`  Found ${streams.length} direct stream URLs:`, streams);
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }
  }
}

testArcHeaders();
