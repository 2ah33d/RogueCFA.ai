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

async function inspectAndClean() {
  console.log('=== INSPECTING DIGEST JOBS IN SUPABASE ===');

  const { data: jobs, error } = await supabase
    .from('digest_jobs')
    .select('id, episode_date, status, result, created_at')
    .order('episode_date', { ascending: false });

  if (error) {
    console.error('Error querying digest_jobs:', error.message);
    return;
  }

  console.log(`Found ${jobs.length} total digest jobs:`);
  for (const j of jobs) {
    const guest = j.result?.digest?.guest || j.result?.guest || 'N/A';
    const videoTitle = j.result?.videoTitle || 'N/A';
    console.log(`Job ID: ${j.id} | Episode Date: ${j.episode_date} | Guest: ${guest} | Title: ${videoTitle}`);
  }

  // Delete mis-tagged July 28 and July 29 rows that used July 27 Lyle Stein data
  console.log('\nCleaning mis-tagged 2026-07-28 and 2026-07-29 jobs...');
  const { error: delErr } = await supabase
    .from('digest_jobs')
    .delete()
    .in('episode_date', ['2026-07-28', '2026-07-29']);

  if (delErr) {
    console.error('Error deleting bad jobs:', delErr.message);
  } else {
    console.log('Successfully deleted bad July 28 and July 29 digest jobs.');
  }
}

inspectAndClean();
