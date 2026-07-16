import fetch from 'node-fetch';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function check() {
  const url = 'https://stockchase.com/discover/expert?q=Brian+Acker';
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  const text = await res.text();
  console.log('Title:', text.match(/<title>(.*?)<\/title>/i)?.[1]);
  // check all hrefs that contain expert
  const experts = text.match(/href="\/expert\/view\/([^"]+)"/g);
  console.log('Found expert links:', experts ? experts.slice(0, 20) : 'None');
  
  // also let's check if there's any search API or json
  const matchAcker = text.match(/Brian Acker[\s\S]{0,300}/i);
  console.log('Brian Acker mention in HTML:', matchAcker ? matchAcker[0] : 'Not found directly');
}

check();
