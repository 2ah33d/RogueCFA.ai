async function inspectBnnShows() {
  console.log('=== INSPECTING BNN BLOOMBERG MARKETCALL SHOWS PAGE ===');
  const showUrl = 'https://www.bnnbloomberg.ca/video/shows/market-call/';

  try {
    const res = await fetch(showUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      console.error(`HTTP Error: ${res.status} ${res.statusText}`);
      return;
    }

    const html = await res.text();
    console.log(`Received ${html.length} bytes of HTML.`);

    // Extract all href links containing 'market-call' or 'video'
    const linkMatches = Array.from(html.matchAll(/href=["']([^"']*?(?:market-call|video)[^"']*?)["']/gi)).map(m => m[1]);
    const uniqueLinks = Array.from(new Set(linkMatches));

    console.log(`Found ${uniqueLinks.length} unique MarketCall video links on show page:`);
    for (const link of uniqueLinks.slice(0, 15)) {
      const fullUrl = link.startsWith('http') ? link : `https://www.bnnbloomberg.ca${link.startsWith('/') ? '' : '/'}${link}`;
      console.log(`  - ${fullUrl}`);
    }

    // Inspect the first article link
    if (uniqueLinks.length > 0) {
      const targetLink = uniqueLinks.find(l => l.includes('/202') || l.includes('top-picks') || l.includes('market-call')) || uniqueLinks[0];
      const targetUrl = targetLink.startsWith('http') ? targetLink : `https://www.bnnbloomberg.ca${targetLink.startsWith('/') ? '' : '/'}${targetLink}`;
      console.log(`\n=== INSPECTING ARTICLE PAGE: ${targetUrl} ===`);

      const artRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      if (artRes.ok) {
        const artHtml = await artRes.text();
        console.log(`Article HTML Size: ${artHtml.length} bytes.`);

        // Find video stream URLs (.m3u8, .mp4, 9c99 CDN, Brightcove, 9c99.com, ctvnews.ca, etc.)
        const videoSources = artHtml.match(/https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|m4a|mp3)[^"'\s>]*/gi) || [];
        console.log(`Direct Media Stream URLs (${videoSources.length}):`, videoSources.slice(0, 10));

        // Find embedded scripts / JSON-LD / video configs
        const scripts = artHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
        console.log(`Found ${scripts.length} script tags. Checking for video metadata...`);
        for (const s of scripts) {
          if (s.includes('m3u8') || s.includes('video') || s.includes('brightcove') || s.includes('axis') || s.includes('9c99')) {
            console.log('\n--- Script Match Snippet ---');
            console.log(s.slice(0, 500));
          }
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectBnnShows();
