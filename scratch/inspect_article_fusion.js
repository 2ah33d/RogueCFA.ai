async function inspectArticleFusion() {
  const url = 'https://www.bnnbloomberg.ca/markets/2026/07/24/andrew-pinks-top-picks-for-july-24-2026/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const match = html.match(/window\.Fusion\.globalContent\s*=\s*(\{[\s\S]*?\});\s*window\.Fusion/);

  if (match && match[1]) {
    const data = JSON.parse(match[1]);
    console.log('Fusion Global Content Keys:', Object.keys(data));
    console.log('Headline:', data.headlines?.basic);
    console.log('Promo items:', JSON.stringify(data.promo_items, null, 2));

    // Check for video streams or video objects
    if (data.content_elements) {
      for (const el of data.content_elements) {
        if (el.type === 'video' || el.streams) {
          console.log('\nVideo Element Found:', JSON.stringify(el, null, 2));
        }
      }
    }
  }
}

inspectArticleFusion();
