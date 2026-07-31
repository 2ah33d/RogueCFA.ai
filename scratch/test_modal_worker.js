async function testModalWorker45s() {
  const url = 'https://ah33d--ytdlp-worker-fastapi-app.modal.run/extract';
  const videoId = 'hPQAsdLiX_M';
  console.log(`=== TESTING LIVE MODAL WORKER (45s timeout): ${url} (videoId: ${videoId}) ===`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
      signal: AbortSignal.timeout(45000),
    });

    console.log('HTTP Status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (e) {
    console.error('Fetch Error:', e.message);
  }
}

testModalWorker45s();
