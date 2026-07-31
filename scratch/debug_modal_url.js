async function debugModalUrl() {
  const rootUrl = 'https://ah33d--ytdlp-worker-fastapi-app.modal.run/';
  console.log(`=== DEBUGGING MODAL ENDPOINT: ${rootUrl} ===`);

  try {
    console.log('Testing GET / ...');
    const r1 = await fetch(rootUrl, { signal: AbortSignal.timeout(10000) });
    console.log('GET / status:', r1.status);
    console.log('GET / body:', await r1.text());
  } catch (e) {
    console.error('GET / error:', e.message);
  }

  try {
    console.log('\nTesting GET /docs ...');
    const r2 = await fetch('https://ah33d--ytdlp-worker-fastapi-app.modal.run/docs', { signal: AbortSignal.timeout(10000) });
    console.log('GET /docs status:', r2.status);
  } catch (e) {
    console.error('GET /docs error:', e.message);
  }
}

debugModalUrl();
