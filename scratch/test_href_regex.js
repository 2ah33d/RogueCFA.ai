async function testHrefRegex() {
  const url = 'https://www.bnnbloomberg.ca/video/';
  console.log(`=== TESTING HREF REGEX MATCHING ON ${url} ===`);

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();

  const matches = Array.from(
    html.matchAll(/href=["'](\/video\/shows\/market-call\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[^"']+?)["']/gi)
  ).map(m => m[1]);

  console.log(`Found ${matches.length} MarketCall video article hrefs:`);
  for (const m of Array.from(new Set(matches))) {
    console.log(`  - https://www.bnnbloomberg.ca${m}`);
  }
}

testHrefRegex();
