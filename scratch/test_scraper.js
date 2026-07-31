import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

const { searchBnnPastPicks, parseBnnPastPicksArticle } = await import('../api/_bnnScraper.js');

const analysts = ['Greg Newman', 'Andrew Pink', 'John Stephenson', 'Julien Nono-Womdim'];

async function main() {
  for (const name of analysts) {
    console.log(`\n========================================`);
    console.log(`Searching BNN for: ${name}`);
    const articles = await searchBnnPastPicks(name, 5);
    console.log(`Articles found (${articles.length}):`, JSON.stringify(articles, null, 2));

    for (const art of articles) {
      console.log(`Fetching: ${art.url}`);
      try {
        const res = await fetch(art.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          }
        });
        const html = await res.text();
        const parsed = parseBnnPastPicksArticle(html, art.url, name);
        console.log(`Parsed rows count for ${art.title}: ${parsed.length}`);
        if (parsed.length > 0) {
          console.log('Parsed rows:', JSON.stringify(parsed, null, 2));
        }
      } catch (err) {
        console.error('Fetch err:', err.message);
      }
    }
  }
}

main().catch(console.error);
