async function testArcSectionApi() {
  console.log('=== TESTING ARC CONTENT FETCH ENDPOINTS FOR MARKETCALL ===');

  const endpoints = [
    `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/story-feed-by-section-alias?query=${encodeURIComponent(JSON.stringify({ section: '/video/shows/market-call', size: 10 }))}&d=222&_website=bnn-bloomberg`,
    `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/section-navigation?query=${encodeURIComponent(JSON.stringify({ section: '/video/shows/market-call' }))}&d=222&_website=bnn-bloomberg`,
    `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/content-api-collections?query=${encodeURIComponent(JSON.stringify({ collection_alias: 'market-call', size: 10 }))}&d=222&_website=bnn-bloomberg`,
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting endpoint: ${ep.slice(0, 90)}...`);
    try {
      const res = await fetch(ep, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      });

      console.log('  HTTP Status:', res.status, res.statusText);
      if (res.ok) {
        const data = await res.json();
        console.log('  Response Keys:', Object.keys(data));
        const items = data.content_elements || data.items || [];
        console.log(`  Items returned: ${items.length}`);
        for (const item of items.slice(0, 5)) {
          console.log(`    Headline: ${item.headlines?.basic || item.title}`);
          console.log(`    Date: ${item.display_date || item.publish_date}`);
          console.log(`    URL: ${item.canonical_url}`);
          console.log(`    Stream:`, item.streams || item.promo_items?.basic?.streams);
        }
      }
    } catch (err) {
      console.log('  Error:', err.message);
    }
  }
}

testArcSectionApi();
