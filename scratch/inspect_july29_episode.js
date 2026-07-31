async function inspectJuly29Episode() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/';
  console.log(`=== INSPECTING LIVE MARKET CALL SHOW PAGE: ${url} ===`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    console.log('HTTP Status:', res.status);
    if (!res.ok) return;

    const html = await res.text();
    console.log(`HTML size: ${html.length} bytes`);

    // Parse all video cards / links / script tags inside the show page
    const videoMatches = html.match(/href=["'](\/video\/[^"']+?)["']/gi) || [];
    console.log(`Found ${videoMatches.length} total video links:`);
    const unique = Array.from(new Set(videoMatches.map(m => m.replace(/^href=["']|["']$/g, ''))));

    for (const link of unique.slice(0, 15)) {
      console.log(`  - https://www.bnnbloomberg.ca${link}`);
    }

    // Inspect script tags or JSON data
    const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    console.log(`\nFound ${jsonLd.length} JSON-LD blocks.`);
    for (const j of jsonLd) {
      console.log(j.slice(0, 400));
    }

    // Look for Fusion.globalContent or content_elements
    const fusionIdx = html.indexOf('window.Fusion.globalContent=');
    if (fusionIdx !== -1) {
      const jsonStart = fusionIdx + 'window.Fusion.globalContent='.length;
      const jsonEnd = html.indexOf('};', jsonStart);
      const fusionJsonStr = html.slice(jsonStart, jsonEnd + 1);
      try {
        const data = JSON.parse(fusionJsonStr);
        console.log('\n=== PARSED FUSION GLOBAL CONTENT ===');
        console.log('Name:', data.name || data.headlines?.basic);
        const queryResults = data.query_results || data.content_elements || [];
        console.log(`Query Results Count: ${queryResults.length}`);
        for (const q of queryResults.slice(0, 10)) {
          console.log(`\nHeadline: ${q.headlines?.basic || q.title}`);
          console.log(`Publish Date: ${q.display_date || q.publish_date}`);
          console.log(`Canonical URL: ${q.canonical_url}`);
          console.log(`Streams:`, q.promo_items?.basic?.streams || q.streams);
        }
      } catch (e) {
        console.log('Fusion parse error:', e.message);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectJuly29Episode();
