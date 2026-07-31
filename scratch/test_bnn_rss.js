async function testRss() {
  const url = 'https://www.omnycontent.com/d/playlist/4809bc8a-e41a-405c-93da-a8cf011df2f4/fcfd42e4-d5c6-4b4a-8c62-ae32016f1b9a/4ecaf48c-23a4-4f5e-84b3-ae3201711923/podcast.rss';
  const res = await fetch(url);
  const xml = await res.text();
  const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  console.log(`Found ${items.length} RSS podcast episodes:`);
  items.slice(0, 5).forEach((item, idx) => {
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
    const enclosureMatch = item.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
    const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    console.log(`Episode #${idx + 1}:`);
    console.log(`  Title: ${titleMatch ? titleMatch[1] : 'N/A'}`);
    console.log(`  Date: ${pubDateMatch ? pubDateMatch[1] : 'N/A'}`);
    console.log(`  Audio URL: ${enclosureMatch ? enclosureMatch[1] : 'N/A'}`);
  });
}

testRss();
