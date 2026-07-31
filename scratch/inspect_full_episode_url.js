async function inspectFullEpisodeUrl() {
  const fullEpUrl = 'https://www.bnnbloomberg.ca/video/shows/market-call/2026/07/29/full-episode-market-call-for-wednesday-july-29-2026/';
  console.log(`=== INSPECTING FULL 45-MINUTE EPISODE URL: ${fullEpUrl} ===`);

  try {
    const res = await fetch(fullEpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    console.log('HTTP Status:', res.status);
    if (!res.ok) return;

    const html = await res.text();
    console.log(`HTML size: ${html.length} bytes`);

    // Extract title, duration, and media streams
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const durationMatch = html.match(/"duration":\s*"([^"]+)"/i);
    console.log('Title:', titleMatch ? titleMatch[1].trim() : 'Unknown');
    console.log('Duration:', durationMatch ? durationMatch[1] : 'Unknown');

    const mediaMatches = html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8|m4a|mp3)[^"'\s>]*/gi) || [];
    console.log(`\nFound ${mediaMatches.length} media stream URLs:`);
    for (const m of mediaMatches) {
      console.log(`  - ${m}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

inspectFullEpisodeUrl();
