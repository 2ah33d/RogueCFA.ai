import fs from 'fs';

async function findJasperManifestPattern() {
  const url = 'https://lib.jasperplayer.com/18.0.1/jasper.umd.production.min.js';
  const res = await fetch(url);
  const text = await res.text();

  console.log('=== SEARCHING FOR MANIFEST & M3U8 PATTERNS IN JASPER UMD JS ===');

  const m3u8Matches = text.match(/https?:\/\/[^\s"'`<>]*\.m3u8[^\s"'`<>]*/gi) || [];
  console.log(`Found ${m3u8Matches.length} .m3u8 URLs:`, m3u8Matches);

  const manifestMatches = text.match(/https?:\/\/[^\s"'`<>]*manifest[^\s"'`<>]*/gi) || [];
  console.log(`Found ${manifestMatches.length} manifest URLs:`, manifestMatches);

  // Search for API domain templates inside JS
  const apiDomainMatches = text.match(/https?:\/\/[a-z0-9\.\_\-]+\.[a-z]{2,6}\/[^\s"'`<>]+/gi) || [];
  const bellMediaDomains = Array.from(new Set(apiDomainMatches.filter(d => d.includes('bell') || d.includes('bnn') || d.includes('media') || d.includes('9c'))));
  console.log(`Found ${bellMediaDomains.length} Bell/Media domain templates:`);
  for (const d of bellMediaDomains.slice(0, 20)) {
    console.log(`  - ${d}`);
  }
}

findJasperManifestPattern();
