import fs from 'fs';

async function findArcCollectionApi() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();

  console.log('=== SEARCHING FOR VIDEO COLLECTIONS IN SHOW PAGE HTML ===');

  // Look for any JSON arrays or collection objects
  const collections = html.match(/\{"collection_alias"[\s\S]*?\}/g) || [];
  console.log('Found collection aliases:', collections);

  // Look for Fusion.outputConfig or Fusion.components or Fusion.layout
  const layoutMatch = html.match(/Fusion\.layout\s*=\s*(\{[\s\S]*?\});\s*Fusion/);
  if (layoutMatch) {
    fs.writeFileSync('scratch/layout_dump.json', layoutMatch[1]);
    console.log('Saved scratch/layout_dump.json');
  }

  // Look for any links with video URLs
  const videoUrls = html.match(/https?:\/\/[^"'\s<>]+\/video\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[^"'\s>]*/gi) || [];
  console.log('Dated video URLs in show page HTML:', Array.from(new Set(videoUrls)));
}

findArcCollectionApi();
