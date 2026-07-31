async function inspectBnnNetwork() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();

  // Search for any JSON objects, video IDs, or API queries inside the HTML
  console.log('=== SEARCHING ALL API & VIDEO DATA IN SHOW PAGE ===');

  const fusionData = html.match(/window\.Fusion\.globalContent\s*=\s*(\{[\s\S]*?\});\s*Fusion/);
  if (fusionData) {
    console.log('Fusion Global Content length:', fusionData[1].length);
    // Write fusionData[1] to a scratch file to inspect completely
    import('fs').then(fs => fs.writeFileSync('scratch/fusion_dump.json', fusionData[1]));
    console.log('Wrote scratch/fusion_dump.json');
  } else {
    console.log('No Fusion.globalContent match');
  }
}

inspectBnnNetwork();
