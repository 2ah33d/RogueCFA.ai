async function testJasperConfigApi() {
  console.log('=== TESTING CONFIG.JASPERPLAYER.COM ENDPOINTS FOR 3416829 ===');
  const contentId = '3416829';

  const urls = [
    `https://config.jasperplayer.com/bnn/bnn_web/EN/${contentId}`,
    `https://config.jasperplayer.com/bnn/bnn_web/${contentId}`,
    `https://config.jasperplayer.com/bnn/${contentId}`,
    `https://config.jasperplayer.com/v1/bnn/bnn_web/${contentId}`,
    `https://config.jasperplayer.com/v1/contents/${contentId}`,
    `https://config.jasperplayer.com/contents/${contentId}`,
    `https://config.jasperplayer.com/api/v1/contents/${contentId}`,
  ];

  for (const url of urls) {
    console.log(`\nTesting endpoint: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://embed.jasperplayer.com',
          'Referer': 'https://embed.jasperplayer.com/',
        },
      });

      console.log('  HTTP Status:', res.status, res.statusText);
      if (res.ok) {
        const data = await res.json();
        console.log('  Response Data:', JSON.stringify(data, null, 2).slice(0, 1500));
        const jsonStr = JSON.stringify(data);
        const streams = jsonStr.match(/https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|m4a|mp3)[^"'\s>]*/gi) || [];
        console.log(`  Found ${streams.length} direct stream URLs:`, streams);
      }
    } catch (err) {
      console.log('  Error:', err.message);
    }
  }
}

testJasperConfigApi();
