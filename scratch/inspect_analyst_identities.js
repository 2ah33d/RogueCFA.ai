import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let envPath = '.env.local';
if (!fs.existsSync(envPath)) {
  envPath = '.env';
}

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

async function inspectIdentities() {
  console.log('=== RAW SUPABASE QUERY: ANALYST NAME GROUPS ===');

  // 1. Group count of analyst_name in analyst_track_record
  const { data: allPicks, error: errPicks } = await supabase
    .from('analyst_track_record')
    .select('id, analyst_name, ticker, pick_publish_date, source_article_url');

  if (errPicks) {
    console.error('Error:', errPicks.message);
    return;
  }

  const nameCounts = {};
  for (const row of allPicks || []) {
    const name = row.analyst_name;
    nameCounts[name] = (nameCounts[name] || 0) + 1;
  }

  console.log('\nEXACT VERBATIM ANALYST_NAME COUNTS (analyst_track_record):');
  console.log(JSON.stringify(nameCounts, null, 2));

  console.log('\nRAW ROWS FOR JULIAN / JULIEN / NONO IN DB:');
  const julianRows = (allPicks || []).filter(r => 
    /julian|julien|nono/i.test(r.analyst_name)
  );
  console.log(JSON.stringify(julianRows, null, 2));
}

inspectIdentities();
