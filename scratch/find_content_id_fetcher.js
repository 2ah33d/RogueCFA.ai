import fs from 'fs';

async function findContentIdFetcher() {
  const url = 'https://lib.jasperplayer.com/18.0.1/jasper.umd.production.min.js';
  const res = await fetch(url);
  const text = await res.text();

  const idx = text.indexOf('contentId');
  if (idx !== -1) {
    console.log('Snippet around contentId:');
    console.log(text.slice(idx - 100, idx + 400));
  } else {
    console.log('contentId not found in UMD');
  }

  // Look for 9c99 CDN media stream URL templates (e.g., cdn.9c99.com or 9c99)
  const mediaMatches = text.match(/https?:\/\/[a-z0-9\.\_\-]*9c99[^\s"'`<>]+/gi) ||
                       text.match(/https?:\/\/[a-z0-9\.\_\-]*cloudfront[^\s"'`<>]+/gi) || [];

  console.log('\nCDN Matches in UMD:', Array.from(new Set(mediaMatches)));
}

findContentIdFetcher();
