async function findFull45MinEpisode() {
  console.log('=== SEARCHING BNN BLOOMBERG FOR FULL 45-MINUTE MARKET CALL EPISODES ===');
  const pages = [
    'https://www.bnnbloomberg.ca/video/shows/market-call/',
    'https://www.bnnbloomberg.ca/video/',
  ];

  for (const p of pages) {
    console.log(`\nScanning ${p}...`);
    try {
      const res = await fetch(p, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Search for any video links or article URLs inside the show page
      const videoLinks = html.match(/href=["'](\/video\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[^"']+?|\/video\/shows\/market-call\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[^"']+?)["']/gi) || [];
      console.log(`  Found ${videoLinks.length} dated video links:`);
      const unique = Array.from(new Set(videoLinks.map(m => m.replace(/^href=["']|["']$/g, ''))));

      for (const u of unique) {
        const fullUrl = `https://www.bnnbloomberg.ca${u}`;
        console.log(`\nChecking video article: ${fullUrl}`);
        try {
          const vRes = await fetch(fullUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (!vRes.ok) continue;
          const vHtml = await vRes.text();

          // Extract title, duration, and stream URLs
          const titleMatch = vHtml.match(/<title>([\s\S]*?)<\/title>/i);
          const durationMatch = vHtml.match(/"duration":\s*"([^"]+)"/i);
          const title = titleMatch ? titleMatch[1].trim() : 'Unknown';
          const duration = durationMatch ? durationMatch[1] : 'Unknown';

          console.log(`  Title: ${title}`);
          console.log(`  Duration: ${duration}`);

          const streamMatches = vHtml.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8)[^"'\s>]*/gi) || [];
          console.log(`  Stream URLs (${streamMatches.length}):`);
          for (const s of streamMatches.slice(0, 3)) {
            console.log(`    - ${s}`);
          }
        } catch (err) {
          console.log(`  Error: ${err.message}`);
        }
      }
    } catch (e) {
      console.log(`Error scanning ${p}:`, e.message);
    }
  }
}

findFull45MinEpisode();
