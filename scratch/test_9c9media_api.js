async function test9c9mediaApi() {
  console.log('=== TESTING 9C9MEDIA API ENDPOINTS FOR CONTENT ID 3416829 ===');
  const contentId = '3416829';

  const domains = [
    'https://9c9media.com',
    'https://www.9c9media.com',
    'https://9c9media.ca',
    'https://www.9c9media.ca',
    'https://feed.9c9media.com',
    'https://api.9c9media.com',
    'https://api.9c9media.ca',
    'https://manifest.9c9media.com',
  ];

  const paths = [
    `/api/v1/contents/${contentId}/manifest.m3u8`,
    `/api/v1/contents/${contentId}`,
    `/contents/${contentId}`,
    `/contents/${contentId}/manifest.m3u8`,
    `/v1/contents/${contentId}`,
    `/v1/contents/${contentId}/manifest.m3u8`,
    `/content/${contentId}`,
    `/destination/bnn_web/content/${contentId}/manifest.m3u8`,
    `/destination/bnn_web/contents/${contentId}/manifest.m3u8`,
  ];

  for (const domain of domains) {
    for (const path of paths) {
      const url = `${domain}${path}`;
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
          console.log(`\n🎉 FOUND WORKING STREAM API: ${url}`);
          console.log(`Content (${text.length} bytes):`);
          console.log(text.slice(0, 1000));
        }
      } catch (e) {
        // quiet network error
      }
    }
  }
}

test9c9mediaApi();
