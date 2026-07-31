async function test9c9() {
  const urls = [
    'https://live-news.video.9c9media.com/f/news/bnnbloomberg/manifest.mpd',
    'https://live-news.video.9c9media.com/f/news/bnnbloomberg/manifest.m3u8',
    'https://live-news.video.9c9media.com/f/news/bnnbloomberg/index.m3u8',
    'https://live-news.video.9c9media.com/f/news/bnnbloomberg/playlist.m3u8',
    'https://live-news.video.9c9media.com/f/news/bnnbloomberg/master.m3u8',
    'https://live-news.video.9c9media.com/f/news/bnnbloomberg/bnnbloomberg.m3u8'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.bnnbloomberg.ca/',
          'Origin': 'https://www.bnnbloomberg.ca'
        }
      });
      console.log(`${res.status} ${res.statusText} -> ${url}`);
      if (res.ok) {
        const text = await res.text();
        console.log('Snippet:', text.slice(0, 200));
      }
    } catch (err) {
      console.log(`ERR -> ${url}: ${err.message}`);
    }
  }
}

test9c9();
