async function inspectTimReganPicks() {
  const url = 'https://www.bnnbloomberg.ca/markets/2026/07/29/tim-regans-top-picks-for-july-29-2026/';
  console.log(`=== FETCHING BNN ARTICLE FOR TIM REGAN TOP PICKS: ${url} ===`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    console.log('HTTP Status:', res.status);
    if (!res.ok) return;

    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n');
    console.log('\nArticle Text Content Snippet (first 2500 chars):');
    console.log(text.slice(0, 2500));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

inspectTimReganPicks();
