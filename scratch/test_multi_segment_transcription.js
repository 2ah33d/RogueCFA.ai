import { fetchBnnWebPlayerMedia } from '../api/_bnnWebPlayer.js';

async function testMultiSegmentTranscription() {
  console.log('=== TESTING MULTI-SEGMENT AUDIO STREAM SCRAPER LIVE ===');
  const media = await fetchBnnWebPlayerMedia();
  console.log('Scraped Multi-Segment Media Object:');
  console.log('  Episode Date:', media?.episodeDate);
  console.log('  Title:', media?.videoTitle);
  console.log('  Stream URLs Count:', media?.streamUrls?.length || (media?.streamUrl ? 1 : 0));
  if (media?.streamUrls) {
    for (const s of media.streamUrls) {
      console.log(`    - ${s}`);
    }
  }
}

testMultiSegmentTranscription();
