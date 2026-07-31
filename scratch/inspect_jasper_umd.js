async function inspectJasperUmd() {
  const url = 'https://lib.jasperplayer.com/18.0.1/jasper.umd.production.min.js';
  console.log(`=== FETCHING JASPER UMD JS: ${url} ===`);

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const text = await res.text();
    console.log(`JS Size: ${text.length} bytes`);

    // Search for API endpoints
    const apiMatches = text.match(/https?:\/\/[a-z0-9\.\_\-]+\/9c99[^\s"']*/gi) ||
                       text.match(/https?:\/\/[a-z0-9\.\_\-]+\/api\/[^\s"']*/gi) ||
                       text.match(/https?:\/\/[a-z0-9\.\_\-]+\/video\/[^\s"']*/gi) ||
                       text.match(/https?:\/\/[a-z0-9\.\_\-]+bellmedia[^\s"']*/gi) || [];

    console.log(`Found ${apiMatches.length} API endpoints in Jasper UMD:`);
    for (const m of Array.from(new Set(apiMatches)).slice(0, 20)) {
      console.log(`  - ${m}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectJasperUmd();
