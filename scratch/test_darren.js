import fetch from 'node-fetch';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function testDarren() {
  const url = 'https://stockchase.com/expert/view/1315/Darren-Sissons';
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  const text = await res.text();
  console.log('Darren Sissons page length:', text.length);
  console.log('Title:', text.match(/<title>(.*?)<\/title>/i)?.[1]);
  
  // let's look for Top Picks table entries or tickers on this page
  // Stockchase usually has opinion rows with date, ticker, price, and top pick indicator
  const opinions = text.match(/class="[^"]*opinion[^"]*"[\s\S]{1,1000}/gi) || text.match(/<tr[\s\S]{1,1000}<\/tr>/gi);
  console.log('Found rows/opinions:', opinions ? opinions.length : 0);
  if (opinions && opinions.length > 0) {
    // print out snippet of first 3 rows
    for (const r of opinions.slice(0, 3)) {
      console.log('--- ROW ---');
      console.log(r.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
    }
  }
}

testDarren();
