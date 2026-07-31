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

const { supabase } = await import('../api/supabaseClient.js');
const { searchBnnPastPicks, parseBnnPastPicksArticle } = await import('../api/_bnnScraper.js');

async function seedAnalyst(name) {
  console.log(`\n--- Seeding analyst: "${name}" ---`);
  const articles = await searchBnnPastPicks(name, 10);
  console.log(`Found ${articles.length} articles for ${name}`);

  let totalInserted = 0;
  for (const article of articles) {
    try {
      const res = await fetch(article.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
      });
      if (!res.ok) continue;
      const html = await res.text();
      const rows = parseBnnPastPicksArticle(html, article.url, name);
      if (rows && rows.length > 0) {
        console.log(`Article "${article.title}" yielded ${rows.length} rows`);
        const { data: inserted, error } = await supabase
          .from('analyst_track_record')
          .upsert(rows, {
            onConflict: 'analyst_name, ticker, pick_publish_date',
            ignoreDuplicates: true,
          })
          .select();

        if (error) {
          console.error('Supabase upsert error:', error.message);
        } else {
          totalInserted += inserted ? inserted.length : rows.length;
        }
      }
    } catch (err) {
      console.warn(`Failed article ${article.url}:`, err.message);
    }
  }
  console.log(`Total rows inserted for ${name}: ${totalInserted}`);
}

async function main() {
  const analysts = ['Andrew Pink', 'Greg Newman', 'John Stephenson', 'Julien Nono-Womdim', 'Ryan Isherwood'];
  for (const a of analysts) {
    await seedAnalyst(a);
  }
  console.log('\n--- Seeding complete ---');
}

main().catch(console.error);
