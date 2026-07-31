async function testQuerylyTimRegan() {
  console.log('=== TESTING QUERYLY SEARCH API FOR TIM REGAN ===');

  const querylyKey = '30c1e550-9d04-4c8d-8a2b-240193bb9e24';
  const url = `https://api.queryly.com/v4/search.aspx?queryly_key=${querylyKey}&query=${encodeURIComponent('Market Call Tim Regan')}&endindex=10`;

  try {
    const res = await fetch(url);
    console.log('HTTP Status:', res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      const results = data.results || [];
      console.log(`Queryly returned ${results.length} results:`);
      for (const r of results.slice(0, 5)) {
        console.log(`\nTitle: ${r.title}`);
        console.log(`Date: ${r.pubdate || r.date}`);
        console.log(`URL: ${r.link || r.url}`);
        console.log(`Keys:`, Object.keys(r));
        console.log(`Full Item:`, JSON.stringify(r, null, 2).slice(0, 800));
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testQuerylyTimRegan();
