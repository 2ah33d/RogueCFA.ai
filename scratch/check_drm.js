async function checkDrm() {
  const masterUrl = 'https://live-news.video.9c9media.com/f/news/bnnbloomberg/manifest.m3u8';
  const subPlaylists = [
    'manifest_800_4_video.m3u8',
    'manifest_2048_3_video.m3u8',
    'manifest_3000_2_video.m3u8',
    'manifest_5500_1_video.m3u8',
  ];

  for (const name of subPlaylists) {
    const url = `https://live-news.video.9c9media.com/f/news/bnnbloomberg/${name}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.bnnbloomberg.ca/'
      }
    });
    const text = await res.text();
    const hasDrm = text.includes('EXT-X-KEY');
    console.log(`${name}: DRM Protected = ${hasDrm}`);
    if (!hasDrm) {
      console.log('UNENCRYPTED SUB-PLAYLIST FOUND:', name);
      console.log(text.slice(0, 300));
    }
  }
}

checkDrm();
