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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkJobs() {
  console.log('=== CHECKING ALL DIGEST JOBS IN SUPABASE ===');
  const { data: jobs, error } = await supabase
    .from('digest_jobs')
    .select('id, episode_date, status, result, error_message, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching jobs:', error.message);
    return;
  }

  for (const j of jobs) {
    console.log(`\nJob ID: ${j.id}`);
    console.log(`  Date: ${j.episode_date}`);
    console.log(`  Status: ${j.status}`);
    console.log(`  Error: ${j.error_message || 'none'}`);
    console.log(`  Created: ${j.created_at}`);
    if (j.result?.digest) {
      console.log(`  Guest: ${j.result.digest.guest}`);
      const picks = j.result.digest.picks || j.result.digest.top_picks || [];
      console.log(`  Picks (${picks.length}):`, picks.map(p => p.ticker || p.name).join(', '));
    }
  }
}

checkJobs();
