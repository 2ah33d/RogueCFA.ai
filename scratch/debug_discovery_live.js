import { discoverMarketCallVideos } from '../api/_youtubeFetcher.js';

async function debugDiscoveryLive() {
  console.log('=== DEBUGGING DISCOVERY LIVE ===');
  const result = await discoverMarketCallVideos('2026-07-30');
  console.log('Result:', JSON.stringify(result, null, 2));
}

debugDiscoveryLive();
