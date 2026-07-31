async function findBnnChannelId() {
  const res = await fetch('https://www.youtube.com/@BNNBloomberg', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  
  const channelIdMatch = html.match(/channel_id=([^"&]+)/);
  const externalIdMatch = html.match(/"externalId"\s*:\s*"([^"]+)"/);
  const rssMatch = html.match(/channel_id=([A-Za-z0-9_-]+)/);
  
  console.log('Channel ID from RSS link:', channelIdMatch ? channelIdMatch[1] : 'NOT FOUND');
  console.log('External ID:', externalIdMatch ? externalIdMatch[1] : 'NOT FOUND');
  console.log('RSS match:', rssMatch ? rssMatch[1] : 'NOT FOUND');
  
  const cid = externalIdMatch?.[1] || channelIdMatch?.[1] || rssMatch?.[1];
  if (cid) {
    console.log('\nTesting RSS feed URL...');
    const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`);
    console.log('RSS Status:', rssRes.status);
    if (rssRes.ok) {
      const rssText = await rssRes.text();
      console.log('RSS Feed Preview (first 2000 chars):', rssText.substring(0, 2000));
    }
  }
}

findBnnChannelId();
