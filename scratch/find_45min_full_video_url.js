async function find45MinFullVideoUrl() {
  const showUrl = 'https://www.bnnbloomberg.ca/video/shows/market-call/';
  console.log(`=== FETCHING ALL LINKS ON BNN MARKETCALL SHOW PAGE: ${showUrl} ===`);

  try {
    const res = await fetch(showUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      console.error('HTTP Error:', res.status);
      return;
    }

    const html = await res.text();
    console.log(`Received ${html.length} bytes.`);

    // Extract all hrefs containing /video/
    const hrefMatches = html.match(/href=["'](\/video\/[^"']+?)["']/gi) || [];
    const uniqueHrefs = Array.from(new Set(hrefMatches.map(m => m.replace(/^href=["']|["']$/g, ''))));
    console.log(`\nFound ${uniqueHrefs.length} total video hrefs on show page:`);

    for (const link of uniqueHrefs) {
      console.log(`  - https://www.bnnbloomberg.ca${link}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

find45MinFullVideoUrl();
