async function inspectFusionJson() {
  const url = 'https://www.bnnbloomberg.ca/markets/2026/07/24/andrew-pinks-top-picks-for-july-24-2026/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const startMarker = 'Fusion.globalContent=';
  const startIdx = html.indexOf(startMarker);
  if (startIdx !== -1) {
    const endIdx = html.indexOf('};', startIdx);
    const jsonStr = html.slice(startIdx + startMarker.length, endIdx + 1);
    try {
      const data = JSON.parse(jsonStr);
      console.log('Successfully parsed Fusion globalContent!');
      console.log('Headline:', data.headlines?.basic);
      console.log('Promo items basic:', JSON.stringify(data.promo_items?.basic, null, 2));

      // Search all cloudfront / mp4 / m3u8 URLs in the parsed JSON
      const jsonText = JSON.stringify(data);
      const urls = jsonText.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8|mp3|m4a)/gi) || [];
      console.log('\nMedia URLs inside Fusion JSON:', urls);
    } catch (e) {
      console.error('JSON Parse error:', e.message);
    }
  }
}

inspectFusionJson();
