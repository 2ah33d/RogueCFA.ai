async function testJasperApi() {
  console.log('=== TESTING BELL MEDIA JASPER API ENDPOINTS FOR CONTENT 3416829 ===');
  const contentId = '3416829';

  const apiEndpoints = [
    `https://9c99.com/api/v1/contents/${contentId}`,
    `https://content.9c99.com/api/v1/contents/${contentId}`,
    `https://api.bellmedia.ca/video/v1/contents/${contentId}`,
    `https://feed.9c99.com/contents/${contentId}`,
    `https://lib.jasperplayer.com/api/contents/${contentId}`,
    `https://www.bnnbloomberg.ca/video/api/v1/contents/${contentId}`,
  ];

  for (const url of apiEndpoints) {
    console.log(`\nTesting endpoint: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      });

      console.log('  HTTP Status:', res.status, res.statusText);
      if (res.ok) {
        const data = await res.json();
        console.log('  Response Data:', JSON.stringify(data, null, 2).slice(0, 1000));
      }
    } catch (err) {
      console.log('  Error:', err.message);
    }
  }
}

testJasperApi();
