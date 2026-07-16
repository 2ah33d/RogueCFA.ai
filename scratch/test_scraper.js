import fetch from 'node-fetch';

const ANALYSTS = [
  { name: 'Brian Acker', slug: 'Brian-Acker' },
  { name: 'Christine Poole', slug: 'Christine-Poole' },
  { name: 'Jason Bouvier', slug: 'Jason-Bouvier' },
  { name: 'John Connell', slug: 'John-Connell' },
  { name: 'Bruce Murray', slug: 'Bruce-Murray' },
  { name: 'Chris White', slug: 'Chris-White' },
  { name: 'Andrey Omelchak', slug: 'Andrey-Omelchak' },
  { name: 'Greg Newman', slug: 'Greg-Newman' },
  { name: 'Brendan Caldwell', slug: 'Brendan-Caldwell' },
  { name: 'Paul Harris', slug: 'Paul-Harris' },
  { name: 'Ryan Bushell', slug: 'Ryan-Bushell' },
  { name: 'Rick Rule', slug: 'Rick-Rule' },
  { name: 'Ivana Delevska', slug: 'Ivana-Delevska' },
  { name: 'Michael Hakes', slug: 'Michael-Hakes' },
  { name: 'Kim Bolton', slug: 'Kim-Bolton' },
  { name: 'Bruce Campbell', slug: 'Bruce-Campbell' },
  { name: 'Darren Sissons', slug: 'Darren-Sissons' },
  { name: 'Norm Levine', slug: 'Norm-Levine' },
  { name: 'Larry Berman', slug: 'Larry-Berman' }
];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

async function checkStockchaseSlug(slug) {
  // Try direct expert link e.g. https://stockchase.com/expert/view/Brian-Acker
  const urls = [
    `https://stockchase.com/expert/view/${slug}`,
    `https://stockchase.com/expert/${slug}`,
    `https://stockchase.com/discover/expert?q=${slug.replace('-', '+')}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (res.ok) {
        const text = await res.text();
        // check if Top Picks table or picks exist
        const topPicksMatch = text.match(/Top Picks[\s\S]{1,2000}/i) || text.match(/<table[\s\S]{1,3000}<\/table>/i);
        // find expert link in discovery if discovery URL
        const expertLinks = text.match(/href="(\/expert\/view\/[^"]+)"/g);
        return { status: res.status, url, length: text.length, expertLinks: expertLinks ? expertLinks.slice(0, 3) : null, hasTable: !!topPicksMatch };
      }
    } catch (e) {}
  }
  return { status: 'Failed' };
}

async function run() {
  console.log('Testing exact direct URLs...');
  for (const a of ANALYSTS.slice(0, 5)) {
    const res = await checkStockchaseSlug(a.slug);
    console.log(`${a.name}:`, JSON.stringify(res));
  }
}

run();
