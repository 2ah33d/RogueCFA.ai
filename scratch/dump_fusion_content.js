import fs from 'fs';

async function dumpFusionContent() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();

  const startMarker = 'Fusion.globalContent=';
  const startIdx = html.indexOf(startMarker);
  if (startIdx !== -1) {
    const endIdx = html.indexOf('};', startIdx);
    const jsonStr = html.slice(startIdx + startMarker.length, endIdx + 1);
    fs.writeFileSync('scratch/fusion_dump.json', jsonStr);
    console.log('Saved scratch/fusion_dump.json. Size:', jsonStr.length, 'bytes');

    const data = JSON.parse(jsonStr);
    console.log('\nTop-level Keys:', Object.keys(data));
    if (data.query_results || data.content_elements || data.modules) {
      console.log('Query results:', JSON.stringify(data.query_results || data.content_elements, null, 2).slice(0, 1500));
    }
  } else {
    console.log('Fusion.globalContent= not found in HTML');
  }
}

dumpFusionContent();
