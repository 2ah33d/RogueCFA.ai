async function testTranscodedCdn() {
  console.log('=== TESTING TRANSCODED VIDEO CDN: d3g70guqh4mw9g.cloudfront.net ===');
  const contentId = '3416829';

  const sampleUrls = [
    `https://d3g70guqh4mw9g.cloudfront.net/07-29-2026/${contentId}.mp4`,
    `https://d3g70guqh4mw9g.cloudfront.net/07-29-2026/${contentId}/playlist.m3u8`,
    `https://d3g70guqh4mw9g.cloudfront.net/07-29-2026/t_${contentId}.mp4`,
    `https://d3g70guqh4mw9g.cloudfront.net/07-29-2026/c50a18fd8c5b4944915a4c05b5562845.mp4`,
    `https://d3g70guqh4mw9g.cloudfront.net/07-29-2026/c50a18fd8c5b4944915a4c05b5562845/playlist.m3u8`,
  ];

  for (const url of sampleUrls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      console.log(`URL: ${url} -> Status: ${res.status} | Size: ${res.headers.get('content-length')} bytes`);
    } catch (e) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testTranscodedCdn();
