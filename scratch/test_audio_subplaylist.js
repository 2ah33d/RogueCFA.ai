async function testAudioSubplaylist() {
  const url = 'https://live-news.video.9c9media.com/f/news/bnnbloomberg/manifest_5500_1_audio.m3u8';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': 'https://www.bnnbloomberg.ca/'
    }
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  const text = await res.text();
  console.log('Audio sub-playlist content:\n', text.slice(0, 300));
}

testAudioSubplaylist();
