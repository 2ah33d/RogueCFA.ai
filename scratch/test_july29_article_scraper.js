import { fetchBnnWebPlayerMedia } from '../api/_bnnWebPlayer.js';

async function testJuly29ArticleScraper() {
  console.log('=== TESTING BNN ARTICLE TEXT SCRAPER LIVE ===');
  const media = await fetchBnnWebPlayerMedia();
  console.log('Scraped Media Object:', JSON.stringify(media, null, 2));
}

testJuly29ArticleScraper();
