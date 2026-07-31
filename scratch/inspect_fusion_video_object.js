async function inspectFusionVideoObject() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/2026/07/29/tim-regans-top-picks-brookfield-corp-allegion-plc-thomson-reuters/';
  console.log(`=== INSPECTING FUSION GLOBAL CONTENT FOR TIM REGAN VIDEO ARTICLE: ${url} ===`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return;
    const html = await res.text();

    const startMarker = 'Fusion.globalContent=';
    const startIdx = html.indexOf(startMarker);
    if (startIdx !== -1) {
      const endIdx = html.indexOf('};', startIdx);
      const jsonStr = html.slice(startIdx + startMarker.length, endIdx + 1);
      const data = JSON.parse(jsonStr);

      console.log('\n=== FUSION GLOBAL CONTENT STRUCTURE ===');
      console.log('Type:', data.type);
      console.log('Subtype:', data.subtype);
      console.log('Headlines:', data.headlines);
      console.log('Promo Items:', JSON.stringify(data.promo_items, null, 2));

      if (data.streams) {
        console.log('\nStreams Array:', JSON.stringify(data.streams, null, 2));
      }

      if (data.content_elements) {
        console.log(`\nContent Elements (${data.content_elements.length}):`);
        for (const el of data.content_elements) {
          console.log(`  - Type: ${el.type} | Subtype: ${el.subtype} | ID: ${el._id}`);
          if (el.streams) console.log('    Streams:', el.streams);
          if (el.embed) console.log('    Embed:', el.embed);
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

inspectFusionVideoObject();
