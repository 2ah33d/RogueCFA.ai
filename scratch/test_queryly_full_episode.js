async function testQuerylyFullEpisode() {
  console.log('=== SEARCHING QUERYLY FOR FULL EPISODE MARKET CALL ===');

  const QUERYLY_KEY = 'e5c9f131f6f04418';
  const queryUrl = `https://api.queryly.com/v1/search.aspx?queryly_key=${QUERYLY_KEY}&query=full%20episode%20market%20call&endindex=10&batchsize=10`;

  try {
    const res = await fetch(queryUrl);
    if (!res.ok) return;
    const text = await res.text();
    const data = JSON.parse(text);
    const items = data.items || [];
    console.log(`Queryly returned ${items.length} full episode results:`);
    for (const item of items) {
      console.log(`\nTitle: ${item.title}`);
      console.log(`Date: ${item.date}`);
      console.log(`Link: https://www.bnnbloomberg.ca${item.link}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testQuerylyFullEpisode();
