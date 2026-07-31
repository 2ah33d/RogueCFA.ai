async function inspectJasperPlayer() {
  const embedUrl = 'https://embed.jasperplayer.com/?brand=bnn&destination=bnn_web&language=EN&contentId=3416829';
  console.log(`=== FETCHING JASPER PLAYER EMBED: ${embedUrl} ===`);

  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    console.log('HTTP Status:', res.status);
    if (!res.ok) return;

    const html = await res.text();
    console.log(`HTML Length: ${html.length} bytes`);
    console.log('HTML Content:');
    console.log(html);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectJasperPlayer();
