import { discoverMarketCallVideos } from '../api/_youtubeFetcher.js';

async function testDateFallback() {
  console.log('=== TESTING DATE FALLBACK DISCOVERY FOR 2026-07-30 ===');
  // Pass July 30 (before broadcast airs)
  const videos = await discoverMarketCallVideos('2026-07-30');
  console.log(`Discovered ${videos.length} video(s):`);
  for (const v of videos) {
    console.log(`  - Title: ${v.title}`);
    console.log(`  - Video ID: ${v.videoId}`);
    console.log(`  - Extracted Publish Date: ${v.publishDate}`);
  }
}

testDateFallback();
