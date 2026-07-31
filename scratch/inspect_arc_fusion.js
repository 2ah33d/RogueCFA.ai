async function inspectArcFusion() {
  console.log('=== PARSING BNN BLOOMBERG ARC FUSION GLOBAL CONTENT ===');
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/';

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    const html = await res.text();
    const fusionMatch = html.match(/window\.Fusion\.globalContent\s*=\s*(\{[\s\S]*?\});\s*window\.Fusion/);

    if (fusionMatch && fusionMatch[1]) {
      console.log('Found window.Fusion.globalContent JSON!');
      const data = JSON.parse(fusionMatch[1]);
      console.log('Keys in globalContent:', Object.keys(data));

      // Inspect query_results, content_elements, or promo_items
      const elements = data.content_elements || data.query_results || [];
      console.log(`Found ${elements.length} content elements:`);

      for (const el of elements.slice(0, 5)) {
        console.log(`\nTitle: ${el.headlines?.basic || el.title}`);
        console.log(`ID: ${el._id}`);
        console.log(`Type: ${el.type}`);
        console.log(`Publish Date: ${el.publish_date || el.display_date}`);
        console.log(`Video Streams:`, el.streams || el.promo_items?.basic?.streams);
      }
    } else {
      console.log('Could not find window.Fusion.globalContent match');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectArcFusion();
