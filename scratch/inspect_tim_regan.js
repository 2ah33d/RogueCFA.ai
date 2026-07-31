async function inspectTimReganVideo() {
  const artUrl = 'https://www.bnnbloomberg.ca/video/shows/market-call/2026/07/29/tim-regans-top-picks-brookfield-corp-allegion-plc-thomson-reuters/';
  console.log(`=== FETCHING TIM REGAN JULY 29 VIDEO ARTICLE: ${artUrl} ===`);

  try {
    const res = await fetch(artUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    console.log('HTTP Status:', res.status);
    if (!res.ok) return;

    const html = await res.text();
    console.log(`HTML Size: ${html.length} bytes`);

    // Look for video streams
    const mediaMatches = html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8|mp3|m4a|aac)[^"'\s>]*/gi) || [];
    console.log(`\nFound ${mediaMatches.length} media URLs:`, mediaMatches);

    // Parse Fusion globalContent JSON
    const fusionIdx = html.indexOf('window.Fusion.globalContent=') !== -1
      ? html.indexOf('window.Fusion.globalContent=') + 'window.Fusion.globalContent='.length
      : html.indexOf('Fusion.globalContent=') + 'Fusion.globalContent='.length;

    if (fusionIdx > 30) {
      const endIdx = html.indexOf('};', fusionIdx);
      const jsonStr = html.slice(fusionIdx, endIdx + 1);
      const data = JSON.parse(jsonStr);
      console.log('\n=== PARSED FUSION GLOBAL CONTENT FOR TIM REGAN ===');
      console.log('Headline:', data.headlines?.basic);
      console.log('Publish Date:', data.publish_date || data.display_date);
      console.log('Promo items / Video streams:', JSON.stringify(data.promo_items?.basic?.streams || data.streams || data.video, null, 2));

      // Search all cloudfront / mp4 URLs inside JSON
      const jsonText = JSON.stringify(data);
      const streamUrls = jsonText.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8|m4a|mp3)/gi) || [];
      console.log('\nStream URLs inside Fusion JSON:', streamUrls);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectTimReganVideo();
