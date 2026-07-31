async function testYouTubeSearch() {
  // Try searching for BNN MarketCall on YouTube
  const searchUrl = 'https://www.youtube.com/results?search_query=BNN+Bloomberg+Market+Call+full+episode+July+2026';
  console.log('Fetching YouTube search results...');
  
  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  
  // Extract video IDs from search results
  const videoIdMatches = html.match(/"videoId"\s*:\s*"([^"]{11})"/g) || [];
  const uniqueIds = [...new Set(videoIdMatches.map(m => m.match(/"([^"]{11})"/)[1]))];
  
  console.log(`Found ${uniqueIds.length} unique video IDs:`);
  for (const vid of uniqueIds.slice(0, 10)) {
    console.log(`  - https://www.youtube.com/watch?v=${vid}`);
  }
  
  // Try to get title for each
  for (const vid of uniqueIds.slice(0, 5)) {
    try {
      const vRes = await fetch(`https://www.youtube.com/watch?v=${vid}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const vHtml = await vRes.text();
      const titleMatch = vHtml.match(/<title>([\s\S]*?)<\/title>/i);
      console.log(`\n  ${vid}: ${titleMatch ? titleMatch[1].trim() : 'Unknown title'}`);
    } catch {}
  }

  // Also try BNN's @BNNBloomberg channel videos page
  console.log('\n\n=== Checking @BNNBloomberg channel videos ===');
  const channelRes = await fetch('https://www.youtube.com/@BNNBloomberg/videos', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const channelHtml = await channelRes.text();
  
  const channelVids = channelHtml.match(/"videoId"\s*:\s*"([^"]{11})"/g) || [];
  const channelUniqueIds = [...new Set(channelVids.map(m => m.match(/"([^"]{11})"/)[1]))];
  console.log(`Found ${channelUniqueIds.length} unique video IDs on channel page`);
  
  // Check first 5 for Market Call content
  for (const vid of channelUniqueIds.slice(0, 8)) {
    try {
      const vRes = await fetch(`https://www.youtube.com/watch?v=${vid}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const vHtml = await vRes.text();
      const titleMatch = vHtml.match(/<title>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown';
      if (title.toLowerCase().includes('market call') || title.toLowerCase().includes('market-call')) {
        console.log(`  MATCH: ${vid}: ${title}`);
      } else {
        console.log(`  skip: ${vid}: ${title}`);
      }
    } catch {}
  }
}

testYouTubeSearch();
