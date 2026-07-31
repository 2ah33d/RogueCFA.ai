import { parseBnnPastPicksArticle, parseDateToIso, normalizeAnalystName, searchBnnPastPicks } from '../api/_bnnScraper.js';

const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
<title>Greg Newman’s Top Picks for July 23, 2026 – BNN Bloomberg</title>
<script type="application/ld+json">
{
  "@type": "AnalysisNewsArticle",
  "articleBody": "Greg Newman, Senior Wealth Advisor & Portfolio Manager, Newman Group, ScotiaMcLeod Focus: North American equities Top Picks: Keyera (KEY TSX) PAST PICKS: OCT. 27, 2025 iShares US Aerospace & Defense ETF (ITA CBOE) Then: US$218.90 Now: US$239.56 Return: 9% Total Return: 10% Financial Select Sector SPDR Fund (XLF NYSEARCA) Then: US$53.33 Now: US$55.57 Return: 4% Total Return: 5% iShares Russell 2000 ETF (IWM NYSEARCA) Then: US$250.30 Now: US$291.92 Return: 17% Total Return: 17%"
}
</script>
</head>
<body></body>
</html>
`;

console.log('--- Testing Zero-LLM BNN Scraper ---');
const cleanAnalyst = normalizeAnalystName("Greg Newman, Senior Wealth Advisor, ScotiaMcLeod");
console.log('Normalized Analyst Name:', cleanAnalyst);
console.assert(cleanAnalyst === 'Greg Newman', 'Analyst name normalization failed');

const parsedRows = parseBnnPastPicksArticle(sampleHtml, 'https://www.bnnbloomberg.ca/markets/2026/07/23/greg-newmans-top-picks-for-july-23-2026/', cleanAnalyst);
console.log('Parsed Rows Count:', parsedRows.length);
console.log('Parsed Rows:', JSON.stringify(parsedRows, null, 2));

console.assert(parsedRows.length === 3, 'Expected 3 parsed rows');
console.assert(parsedRows[0].ticker === 'ITA', 'Expected ticker ITA');
console.assert(parsedRows[0].then_price === 218.90, 'Expected then_price 218.90');
console.assert(parsedRows[0].now_price === 239.56, 'Expected now_price 239.56');
console.assert(parsedRows[0].return_pct === 9, 'Expected return_pct 9');
console.assert(parsedRows[0].total_return_pct === 10, 'Expected total_return_pct 10');
console.assert(parsedRows[0].pick_publish_date === '2025-10-27', 'Expected publish date 2025-10-27');

console.log('--- Testing Queryly Search ---');
searchBnnPastPicks('Greg Newman', 3).then((articles) => {
  console.log('Queryly Search Result Articles Count:', articles.length);
  console.log('Articles:', JSON.stringify(articles, null, 2));
  console.log('--- All Unit Tests Passed Successfully! ---');
});
