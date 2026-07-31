async function inspectBnnVideoLinks() {
  const url = 'https://www.bnnbloomberg.ca/video/';
  console.log(`=== INSPECTING ${url} ===`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  console.log(`HTML size: ${html.length} bytes`);

  const links = Array.from(html.matchAll(/href=["'](\/video\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[^"']+?)["']/gi)).map(m => m[1]);
  console.log(`Found ${links.length} dated video article links:`);
  for (const l of Array.from(new Set(links)).slice(0, 10)) {
    console.log(`  - https://www.bnnbloomberg.ca${l}`);
  }
}

inspectBnnVideoLinks();
