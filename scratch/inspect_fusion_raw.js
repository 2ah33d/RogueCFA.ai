async function inspectFusionRaw() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  const html = await res.text();
  const idx = html.indexOf('Fusion.globalContent');
  if (idx !== -1) {
    console.log('Snippet around Fusion.globalContent:');
    console.log(html.slice(idx, idx + 2000));
  } else {
    console.log('Not found');
  }
}
inspectFusionRaw();
