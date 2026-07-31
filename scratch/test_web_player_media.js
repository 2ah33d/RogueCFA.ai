import { fetchBnnWebPlayerMedia } from '../api/_bnnWebPlayer.js';

async function testWebPlayerMedia() {
  console.log('=== TESTING BNN WEB PLAYER MEDIA SCRAPER LIVE ===');
  const media = await fetchBnnWebPlayerMedia();
  console.log('Scraped Media Object:', JSON.stringify(media, null, 2));
}

testWebPlayerMedia();
