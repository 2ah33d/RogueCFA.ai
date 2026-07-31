import { fetchBnnWebPlayerMedia } from '../api/_bnnWebPlayer.js';

async function testFullEpisodePrioritization() {
  console.log('=== TESTING FULL 45-MINUTE EPISODE PRIORITIZATION SCRAPER LIVE ===');
  const media = await fetchBnnWebPlayerMedia();
  console.log('Scraped Media Object:');
  console.log('  Episode Date:', media?.episodeDate);
  console.log('  Title:', media?.videoTitle);
  console.log('  Stream URL:', media?.streamUrl);
  console.log('  Total Segment Streams:', media?.streamUrls?.length || 0);
}

testFullEpisodePrioritization();
