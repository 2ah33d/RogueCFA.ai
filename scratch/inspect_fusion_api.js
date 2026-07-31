async function inspectFusionApi() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const apiMatches = html.match(/\/pf\/api\/v3\/content\/fetch\/[a-z0-9\-\_]+/gi) || [];
  console.log('Arc API Endpoints found in HTML:', Array.from(new Set(apiMatches)));
}
inspectFusionApi();
