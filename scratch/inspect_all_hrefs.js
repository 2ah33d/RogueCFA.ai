async function inspectAllHrefs() {
  const url = 'https://www.bnnbloomberg.ca/video/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const hrefs = Array.from(html.matchAll(/href=["']([^"']+?)["']/gi)).map(m => m[1]);
  console.log(`Total hrefs found: ${hrefs.length}`);
  const unique = Array.from(new Set(hrefs));
  console.log('Sample Hrefs:');
  for (const h of unique.slice(0, 30)) {
    console.log(`  - ${h}`);
  }
}
inspectAllHrefs();
