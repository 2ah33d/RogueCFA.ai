import fetch from 'node-fetch';

const ANALYSTS = [
  'Brian Acker',
  'Christine Poole',
  'Jason Bouvier',
  'John Connell',
  'Bruce Murray',
  'Chris White',
  'Andrey Omelchak',
  'Greg Newman',
  'Brendan Caldwell',
  'Paul Harris',
  'Ryan Bushell',
  'Rick Rule',
  'Ivana Delevska',
  'Michael Hakes',
  'Kim Bolton',
  'Bruce Campbell',
  'Darren Sissons',
  'Norm Levine',
  'Larry Berman'
];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function checkExpertsDirectory() {
  // Let's check stockchase experts directory page if one exists
  const urls = [
    'https://stockchase.com/experts',
    'https://stockchase.com/discover/experts',
    'https://stockchase.com/expert/index'
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: BROWSER_HEADERS });
      console.log(u, '-> status:', res.status);
      if (res.ok) {
        const text = await res.text();
        console.log('Title:', text.match(/<title>(.*?)<\/title>/i)?.[1]);
        // search for any of our analysts in text
        for (const a of ANALYSTS) {
          const match = text.match(new RegExp(`href="(/expert/view/[0-9]+/[^"]+)"[^>]*>[^<]*${a.split(' ')[1]}`, 'i'));
          if (match) {
            console.log(`Found ${a}: https://stockchase.com${match[1]}`);
          }
        }
      }
    } catch (e) {
      console.log(u, '-> error:', e.message);
    }
  }
}

checkExpertsDirectory();
