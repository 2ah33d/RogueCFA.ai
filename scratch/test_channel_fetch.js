async function testChannelFetch() {
  const url = 'https://www.youtube.com/@BNNBloomberg/videos';
  console.log('Fetching', url);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('HTML length:', html.length);
  const videoIdMatches = html.match(/"videoId"\s*:\s*"([^"]{11})"/g) || [];
  console.log('Video ID matches count:', videoIdMatches.length);
  const uniqueIds = [...new Set(videoIdMatches.map((m) => m.match(/"([^"]{11})"/)[1]))];
  console.log('Unique IDs:', uniqueIds.slice(0, 10));
}

testChannelFetch();
