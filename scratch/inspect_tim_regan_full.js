async function inspectTimReganFull() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/2026/07/29/tim-regans-top-picks-brookfield-corp-allegion-plc-thomson-reuters/';
  console.log(`=== INSPECTING TIM REGAN VIDEO ARTICLE PAGE: ${url} ===`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      console.error('HTTP Error:', res.status);
      return;
    }

    const html = await res.text();
    console.log(`Received ${html.length} bytes.`);

    // 1. Search for all CloudFront / mp4 / m3u8 / m4a / mp3 / webm URLs
    const allMedia = html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8|m4a|mp3|webm)[^"'\s>]*/gi) || [];
    console.log(`\nAll Media URLs found (${allMedia.length}):`);
    for (const m of allMedia) {
      console.log(`  - ${m}`);
    }

    // 2. Search for any video ID, brightcove ID, or embedded player config
    const playerConfigs = html.match(/video_id|videoId|video_url|videoUrl|stream_url|streamUrl|embed_url|embedUrl/gi) || [];
    console.log(`\nPlayer Config Keywords found: ${playerConfigs.length}`);

    // 3. Search for video script tags or JSON-LD
    const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    console.log(`\nJSON-LD blocks found: ${jsonLd.length}`);
    for (const j of jsonLd) {
      console.log(j);
    }

    // 4. Check text content of article for transcript or past picks
    const textSnippet = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    console.log(`\nArticle Text Snippet (first 1000 chars):`);
    console.log(textSnippet.slice(0, 1000));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectTimReganFull();
