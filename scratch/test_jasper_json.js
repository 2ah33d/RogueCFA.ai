async function testJasperJson() {
  console.log('=== TESTING JASPER CONFIG JSON ENDPOINTS ===');

  const urls = [
    'https://config.jasperplayer.com/bnn/bnn_web/EN/jasperConfig.json',
    'https://config.jasperplayer.com/bnn/bnn_web/jasperConfig.json',
    'https://config.jasperplayer.com/bnn/jasperConfig.json',
    'https://config.jasperplayer.com/jasperConfig.json',
  ];

  for (const url of urls) {
    console.log(`\nTesting: ${url}`);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      console.log('  HTTP Status:', res.status, res.statusText);
      if (res.ok) {
        const data = await res.json();
        console.log('  Response Data:', JSON.stringify(data, null, 2).slice(0, 1500));
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }
  }
}

testJasperJson();
