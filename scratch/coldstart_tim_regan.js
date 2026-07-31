import fs from 'fs';
import { searchBnnPastPicks, parseBnnPastPicksArticle } from '../api/_bnnScraper.js';
import { createClient } from '@supabase/supabase-js';

let envPath = '.env.local';
if (!fs.existsSync(envPath)) envPath = '.env';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function coldStartTimRegan() {
  const guest = 'Tim Regan';
  console.log(`=== RUNNING COLD-START INGESTION FOR ${guest} ===`);

  const articles = await searchBnnPastPicks(guest, 10);
  console.log(`Found ${articles.length} BNN past picks articles for ${guest}:`);

  const scrapedRows = [];
  for (const art of articles) {
    console.log(`\nScraping article: ${art.url}`);
    try {
      const res = await fetch(art.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const parsed = parseBnnPastPicksArticle(html, art.url, guest);
      console.log(`  Parsed ${parsed.length} pick rows`);
      if (parsed.length > 0) {
        scrapedRows.push(...parsed);
      }
    } catch (e) {
      console.warn(`  Article scrape error:`, e.message);
    }
  }

  if (scrapedRows.length > 0) {
    console.log(`\nUpserting ${scrapedRows.length} total rows for ${guest} into Supabase...`);
    const { data: inserted, error } = await supabase
      .from('analyst_track_record')
      .upsert(scrapedRows, {
        onConflict: 'analyst_name, ticker, pick_publish_date',
        ignoreDuplicates: true,
      })
      .select();

    if (error) {
      console.error('Supabase upsert error:', error.message);
    } else {
      console.log(`Successfully upserted ${inserted?.length || scrapedRows.length} rows for ${guest}!`);
    }
  } else {
    console.log(`No past pick rows found for ${guest}.`);
  }
}

coldStartTimRegan();
