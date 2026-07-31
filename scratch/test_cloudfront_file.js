async function testCloudfrontFile() {
  const url = 'https://d35q85qtwj799z.cloudfront.net/bellmediainc/2026/07/29/6a6a3595fdde4e2ca2c3ae65/Placeholder.mp4';
  console.log(`=== TESTING CLOUDFRONT FILE METADATA: ${url} ===`);

  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log('HTTP Status:', res.status, res.statusText);
    console.log('Content-Length:', res.headers.get('content-length'), 'bytes');
    const bytes = parseInt(res.headers.get('content-length') || '0', 10);
    console.log(`File Size: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testCloudfrontFile();
