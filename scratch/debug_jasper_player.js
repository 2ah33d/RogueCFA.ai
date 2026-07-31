async function debugJasperPlayer() {
  const contentId = '3416829';
  console.log(`=== DEBUGGING JASPER PLAYER FOR CONTENT ID ${contentId} ===`);

  // Try Jasper API endpoint variations
  const testUrls = [
    `https://api.bellmedia.ca/video/v1/contents/${contentId}`,
    `https://feed.9c99.com/contents/${contentId}`,
    `https://lib.jasperplayer.com/api/contents/${contentId}`,
    `https://embed.jasperplayer.com/api/v1/content?contentId=${contentId}&brand=bnn`,
    `https://cms.jasperplayer.com/v1/configuration?brand=bnn&destination=bnn_web&language=EN&contentId=${contentId}`,
    `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/video-by-id?query=${encodeURIComponent(JSON.stringify({ id: contentId }))}&d=222&_website=bnn-bloomberg`,
  ];

  for (const url of testUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://www.bnnbloomberg.ca',
          'Referer': 'https://www.bnnbloomberg.ca/',
        },
      });
      console.log(`URL: ${url}`);
      console.log(`  Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Response (${text.length} bytes): ${text.slice(0, 500)}`);
      }
    } catch (e) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

debugJasperPlayer();
