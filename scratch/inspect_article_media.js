async function inspectArticleMedia() {
  const url = 'https://www.bnnbloomberg.ca/markets/2026/07/24/andrew-pinks-top-picks-for-july-24-2026/';
  console.log(`=== FETCHING ARTICLE MEDIA: ${url} ===`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    console.log('HTTP Status:', res.status);
    if (!res.ok) return;

    const html = await res.text();
    console.log(`HTML size: ${html.length} bytes`);

    // Look for video tags, iframe, 9c99, brightcove, m3u8, mp4, mp3, m4a
    const mediaMatches = html.match(/https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|mp3|m4a|aac)[^"'\s>]*/gi) || [];
    console.log(`Found ${mediaMatches.length} media URLs:`, mediaMatches);

    const iframes = html.match(/<iframe[^>]*src=["']([^"']+?)["']/gi) || [];
    console.log(`Found ${iframes.length} iframe embeds:`, iframes);

    const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    console.log(`Found ${scriptTags.length} script tags.`);
    for (const s of scriptTags) {
      if (s.includes('video') || s.includes('stream') || s.includes('player') || s.includes('media') || s.includes('9c99') || s.includes('brightcove')) {
        console.log('\n--- Script Match Snippet ---');
        console.log(s.slice(0, 400));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectArticleMedia();
