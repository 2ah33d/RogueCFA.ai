async function testInspectVideo() {
  const vid = 'hPQAsdLiX_M';
  const vRes = await fetch(`https://www.youtube.com/watch?v=${vid}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  console.log('Status:', vRes.status);
  const vHtml = await vRes.text();
  const titleMatch = vHtml.match(/<title>([\s\S]*?)<\/title>/i);
  console.log('Title match:', titleMatch ? titleMatch[1] : 'NONE');
}

testInspectVideo();
