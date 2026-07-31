import { discoverMarketCallVideos } from '../api/_youtubeFetcher.js';

async function testDiscovery() {
  console.log('=== TESTING YOUTUBE MARKET CALL VIDEO DISCOVERY ===');
  const todayStr = '2026-07-29';
  const videos = await discoverMarketCallVideos(todayStr);
  console.log(`Found ${videos.length} MarketCall video(s) for ${todayStr}:`);
  for (const v of videos) {
    console.log(`  - [${v.videoId}] ${v.title} (${v.publishDate})`);
  }
}

testDiscovery();
