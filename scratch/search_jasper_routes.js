import fs from 'fs';

async function searchJasperRoutes() {
  const url = 'https://lib.jasperplayer.com/18.0.1/jasper.umd.production.min.js';
  const res = await fetch(url);
  const text = await res.text();

  const patterns = [
    /https?:\/\/[^\s"'`<>]+/g,
    /\/api\/[^\s"'`<>]+/g,
    /9c99[^\s"'`<>]+/g,
  ];

  for (const pat of patterns) {
    const matches = text.match(pat) || [];
    const unique = Array.from(new Set(matches)).filter(m => m.includes('bell') || m.includes('jasper') || m.includes('video') || m.includes('content'));
    console.log(`Matches for ${pat}: ${unique.length}`);
    for (const u of unique.slice(0, 15)) {
      console.log(`  - ${u}`);
    }
  }
}

searchJasperRoutes();
