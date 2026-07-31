function buildFullEpisodeUrl(d = new Date()) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  const weekdayName = weekdays[d.getUTCDay()];
  const monthName = months[d.getUTCMonth()];

  const slug = `full-episode-market-call-for-${weekdayName}-${monthName}-${parseInt(day, 10)}-${year}`;
  return `https://www.bnnbloomberg.ca/video/shows/market-call/${year}/${month}/${day}/${slug}/`;
}

async function testFullEpisodeUrlBuilder() {
  const url = buildFullEpisodeUrl(new Date('2026-07-29T12:00:00Z'));
  console.log('Constructed Full Episode URL:', url);

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log('HTTP Status:', res.status);
    if (res.ok) {
      const html = await res.text();
      const durationMatch = html.match(/"duration":\s*"([^"]+)"/i);
      console.log('Duration:', durationMatch ? durationMatch[1] : 'Unknown');
      const mediaMatches = html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8)[^"'\s>]*/gi) || [];
      console.log('Media Stream URL:', mediaMatches[0]);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testFullEpisodeUrlBuilder();
