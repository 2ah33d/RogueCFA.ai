async function testBell9c9Api() {
  console.log('=== TESTING BELL MEDIA 9C9 API ENDPOINTS FOR 3416829 ===');

  const contentId = '3416829';

  const testEndpoints = [
    `https://9c9media.bellmedia.ca/api/v1/contents/${contentId}/manifest.m3u8`,
    `https://content.9c9media.ca/api/v1/contents/${contentId}/manifest.m3u8`,
    `https://video.9c9media.ca/api/v1/contents/${contentId}/manifest.m3u8`,
    `https://feed.9c9media.ca/api/v1/contents/${contentId}/manifest.m3u8`,
    `https://9c9media.com/api/v1/contents/${contentId}/manifest.m3u8`,
    `https://9c9media.bell.ca/api/v1/contents/${contentId}/manifest.m3u8`,
    `https://www.bnnbloomberg.ca/api/v1/contents/${contentId}/manifest.m3u8`,
    `https://www.bnnbloomberg.ca/video/api/v1/contents/${contentId}/manifest.m3u8`,
  ];

  for (const url of testEndpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        },
      });
      console.log(`URL: ${url} -> Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`\n🎉 WORKING API ENDPOINT: ${url}`);
        console.log(`Response (${text.length} bytes):`);
        console.log(text.slice(0, 1000));
      }
    } catch (e) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testBell9c9Api();
