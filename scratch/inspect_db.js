import fs from 'fs';
import path from 'path';
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

async function inspectData() {
  console.log('=== REAL SUPABASE DATABASE INSPECTION ===');

  // 1. Get total guest count and total pick rows in analyst_track_record
  const { data: allPicks, error: errPicks } = await supabase
    .from('analyst_track_record')
    .select('analyst_name, ticker, pick_publish_date');

  if (errPicks) {
    console.error('Error querying analyst_track_record:', errPicks.message);
  } else {
    const uniqueGuests = new Set((allPicks || []).map(p => p.analyst_name.trim().toLowerCase()));
    console.log(`\n1. analyst_track_record table:`);
    console.log(`   - Total Pick Rows in Storage: ${allPicks.length}`);
    console.log(`   - Unique Analysts Stored: ${uniqueGuests.size}`);
    console.log(`   - Analysts List:`, Array.from(uniqueGuests));
  }

  // 2. Get digest jobs count in digest_jobs
  const { data: allDigests, error: errDigests } = await supabase
    .from('digest_jobs')
    .select('id, episode_date, status, result');

  if (errDigests) {
    console.error('Error querying digest_jobs:', errDigests.message);
  } else {
    console.log(`\n2. digest_jobs table:`);
    console.log(`   - Total Jobs Stored: ${allDigests.length}`);
    const completed = allDigests.filter(d => d.status === 'complete');
    console.log(`   - Completed Digests: ${completed.length}`);
  }

  // 3. Inspect EIF.TO rows specifically to resolve date discrepancy
  const { data: eifRows } = await supabase
    .from('analyst_track_record')
    .select('*')
    .ilike('ticker', '%EIF%');

  console.log(`\n3. EIF.TO Rows in DB:`, eifRows);
}

inspectData();
