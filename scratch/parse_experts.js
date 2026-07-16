import fetch from 'node-fetch';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function parseAllExperts() {
  const res = await fetch('https://stockchase.com/experts', { headers: BROWSER_HEADERS });
  const text = await res.text();
  
  const regex = /href="(\/expert\/view\/([0-9]+)\/([^"]+))"/g;
  let match;
  const experts = [];
  while ((match = regex.exec(text)) !== null) {
    experts.push({ url: match[1], id: match[2], slug: match[3] });
  }
  console.log(`Found ${experts.length} expert links on /experts page.`);
  if (experts.length > 0) {
    console.log('Sample links:', experts.slice(0, 15));
  } else {
    // let's see what hrefs exist on the page related to expert
    const anyExpert = text.match(/href="[^"]*expert[^"]*"/gi);
    console.log('Any expert hrefs:', anyExpert ? anyExpert.slice(0, 20) : 'None');
  }
}

parseAllExperts();
