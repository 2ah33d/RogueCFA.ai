async function testInspect() {
  const vid = 'hPQAsdLiX_M';
  const todayStr = '2026-07-30';
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const monthShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const [year, month, day] = todayStr.split('-');
  const mi = parseInt(month, 10) - 1;
  const dayNum = parseInt(day, 10);

  const dateFragments = [
    `${monthNames[mi]} ${dayNum}, ${year}`,
    `${monthNames[mi]} ${dayNum} ${year}`,
    `${monthShort[mi]} ${dayNum}`,
    `(${monthNames[mi]} ${dayNum}`,
  ];

  const vRes = await fetch(`https://www.youtube.com/watch?v=${vid}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const vHtml = await vRes.text();
  const titleMatch = vHtml.match(/<title>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : '';
  const titleLower = rawTitle.toLowerCase();

  console.log('rawTitle:', rawTitle);
  console.log('titleLower includes market call:', titleLower.includes('market call'));
  console.log('isTodayMatch:', dateFragments.some((frag) => titleLower.includes(frag)));
}

testInspect();
