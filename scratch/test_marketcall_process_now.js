async function testMarketCallProcessNow() {
  const url = 'https://roguecfa.vercel.app/api/marketcall-process';
  console.log(`=== TESTING LIVE /api/marketcall-process NOW (post 03:01:48 AM Modal deploy) ===`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    });

    console.log('HTTP Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (e) {
    console.error('Fetch Error:', e.message);
  }
}

testMarketCallProcessNow();
