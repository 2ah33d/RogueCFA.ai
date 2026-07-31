async function testBnnVideoPage() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/';
  console.log(`=== TESTING BNN BLOOMBERG MARKETCALL VIDEO PAGE: ${url} ===`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    if (!res.ok) return;

    const html = await res.text();
    console.log(`HTML Length: ${html.length} bytes`);

    // Look for video links, m3u8 playlists, brightcove IDs, or video player embeds
    const m3u8Matches = html.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi) || [];
    console.log(`\nFound ${m3u8Matches.length} .m3u8 HLS playlist URLs:`);
    m3u8Matches.slice(0, 5).forEach(m => console.log(`  - ${m}`));

    const videoLinks = html.match(/\/video\/[^\s"'<>]+/gi) || [];
    console.log(`\nFound ${videoLinks.length} video page links:`);
    videoLinks.slice(0, 10).forEach(v => console.log(`  - https://www.bnnbloomberg.ca${v}`));

    // Check for Brightcove / Video Player IDs
    const brightcoveMatches = html.match(/(?:data-video-id|videoId|account-id|brightcove)[="'\s:]+([0-9]{10,})/gi) || [];
    console.log(`\nBrightcove / Video ID markers:`, brightcoveMatches.slice(0, 10));

  } catch (err) {
    console.error('Error fetching BNN video page:', err.message);
  }
}

testBnnVideoPage();
