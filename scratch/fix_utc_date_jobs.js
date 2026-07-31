import fs from 'fs';
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

async function fixUtcJobs() {
  console.log('=== FIXING UTC DATE OVERFLOW JOBS IN SUPABASE ===');

  // Update any job with episode_date = '2026-07-30' to '2026-07-29'
  const { data: badJobs, error: selectErr } = await supabase
    .from('digest_jobs')
    .select('id, episode_date, result')
    .eq('episode_date', '2026-07-30');

  if (badJobs && badJobs.length > 0) {
    console.log(`Found ${badJobs.length} jobs tagged with episode_date 2026-07-30. Correcting date to 2026-07-29...`);
    for (const job of badJobs) {
      if (job.result) {
        job.result.episodeDate = '2026-07-29';
      }
      await supabase
        .from('digest_jobs')
        .update({
          episode_date: '2026-07-29',
          result: job.result,
        })
        .eq('id', job.id);
    }
    console.log('Successfully updated jobs to 2026-07-29.');
  } else {
    console.log('No 2026-07-30 jobs found.');
  }
}

fixUtcJobs();
