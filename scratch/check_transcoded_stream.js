async function checkTranscodedStream() {
  const artUrl = 'https://www.bnnbloomberg.ca/video/shows/market-call/2026/07/29/tim-regans-top-picks-brookfield-corp-allegion-plc-thomson-reuters/';
  console.log(`=== CHECKING TRANSCODED STREAM FOR TIM REGAN: ${artUrl} ===`);

  const res = await fetch(artUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();

  const mediaMatches = html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8|m4a|mp3)[^"'\s>]*/gi) || [];
  console.log(`Found ${mediaMatches.length} media stream URLs:`);
  for (const m of mediaMatches) {
    console.log(`  - ${m}`);
  }
}

checkTranscodedStream();
