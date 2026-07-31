async function testLiveDeployedModal() {
  const url = 'https://ah33d--ytdlp-worker-fastapi-app.modal.run/extract';
  const videoId = 'hPQAsdLiX_M';
  console.log(`=== TESTING LIVE DEPLOYED MODAL ENDPOINT: ${url} (videoId: ${videoId}) ===`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });

    console.log('HTTP Status:', res.status);
    const data = await res.json();
    console.log('Response status:', data.status);
    console.log('Video ID:', data.videoId);
    console.log('Title:', data.title);
    console.log('Audio Format:', data.audioFormat);
    console.log('Duration:', data.duration, 'seconds');
    console.log('Stream URL preview:', (data.streamUrl || data.stream_url || '').substring(0, 100) + '...');
  } catch (e) {
    console.error('Fetch Error:', e.message);
  }
}

testLiveDeployedModal();
