async function testIngest() {
  const url = 'https://roguecfa.vercel.app/api/ingest';
  console.log('Testing live Vercel route:', url);
  try {
    const res = await fetch(url, { method: 'GET' });
    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    const data = await res.json().catch(() => ({}));
    console.log('Response:', data);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testIngest();
