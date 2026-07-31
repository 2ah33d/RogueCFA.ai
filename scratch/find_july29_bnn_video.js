async function findJuly29BnnVideo() {
  console.log('=== SEARCHING BNN BLOOMBERG FOR JULY 29 EPISODE ===');
  const pages = [
    'https://www.bnnbloomberg.ca/video/shows/market-call/',
    'https://www.bnnbloomberg.ca/video/',
    'https://www.bnnbloomberg.ca/markets/',
    'https://www.bnnbloomberg.ca/',
  ];

  for (const pageUrl of pages) {
    console.log(`\nScanning ${pageUrl}...`);
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (res.ok) {
        const html = await res.text();
        console.log(`  Page Size: ${html.length} bytes`);

        // Search for 2026/07/29 or 2026/07/28 or Tim Regan
        const matches = html.match(/href=["']([^"']*?(?:2026\/07\/29|2026\/07\/28|tim-regan|ryan-isherwood|market-call)[^"']*?)["']/gi) || [];
        console.log(`  Found ${matches.length} matching href links:`);
        const unique = Array.from(new Set(matches.map(m => m.replace(/^href=["']|["']$/g, ''))));
        for (const u of unique.slice(0, 10)) {
          console.log(`    - https://www.bnnbloomberg.ca${u}`);
        }
      }
    } catch (err) {
      console.log('  Error:', err.message);
    }
  }
}

findJuly29BnnVideo();
