async function inspectJasperJs() {
  const jsUrl = 'https://embed.jasperplayer.com/index.js';
  console.log(`=== FETCHING JASPER PLAYER JS: ${jsUrl} ===`);

  try {
    const res = await fetch(jsUrl);
    if (!res.ok) return;
    const jsText = await res.text();
    console.log(`JS Size: ${jsText.length} bytes`);

    // Look for API endpoints, https:// URLs, or 9c99 / bellmedia URLs
    const urls = jsText.match(/https?:\/\/[^"'\s<>]+\/api\/[^"'\s>]*/gi) || jsText.match(/https?:\/\/[^"'\s<>]+/gi) || [];
    console.log(`Found ${urls.length} URLs in Jasper JS:`);
    const unique = Array.from(new Set(urls));
    for (const u of unique.slice(0, 15)) {
      console.log(`  - ${u}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectJasperJs();
