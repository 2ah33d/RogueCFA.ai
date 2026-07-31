async function testModalExtractEndpoint() {
  const url = 'https://ah33d--ytdlp-worker-extract.modal.run';
  const videoId = 'hPQAsdLiX_M';
  console.log(`=== TESTING MODAL EXTRACT ENDPOINT: ${url} (videoId: ${videoId}) ===`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
      signal: AbortSignal.timeout(15000),
    });

    console.log('HTTP Status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (e) {
    console.error('Fetch Error:', e.message);
  }
}

testModalExtractEndpoint();
