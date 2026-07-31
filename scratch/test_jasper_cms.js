async function testJasperCms() {
  const contentId = '3416829';
  const url = `https://cms.jasperplayer.com/configuration?brand=bnn&destination=bnn_web&language=EN&contentId=${contentId}`;
  console.log(`=== TESTING JASPER CMS CONFIGURATION ENDPOINT: ${url} ===`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://embed.jasperplayer.com',
        'Referer': 'https://embed.jasperplayer.com/',
      },
    });

    console.log('HTTP Status:', res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      console.log('\n=== REVEALED JASPER CMS MEDIA STREAMS ===');
      console.log(JSON.stringify(data, null, 2).slice(0, 3000));

      // Extract all .m3u8, .mp4, .mp3, .m4a stream URLs from the JSON
      const jsonStr = JSON.stringify(data);
      const mediaUrls = jsonStr.match(/https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|m4a|mp3)[^"'\s>]*/gi) || [];
      console.log(`\nDirect Media Stream URLs (${mediaUrls.length}):`);
      for (const m of mediaMatches) {
        console.log(`  - ${m}`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testJasperCms();
