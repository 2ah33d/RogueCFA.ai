async function testArcApi() {
  console.log('=== TESTING ARC PUBLISHING CONTENT API ===');

  const endpoint = `https://www.bnnbloomberg.ca/pf/api/v3/content/fetch/content-api-collections?query=${encodeURIComponent(JSON.stringify({
    collection_alias: 'market-call-video-latest',
    size: 5
  }))}&d=222&_website=bnn-bloomberg`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    console.log('HTTP Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Arc API Data:', JSON.stringify(data, null, 2).slice(0, 1000));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testArcApi();
