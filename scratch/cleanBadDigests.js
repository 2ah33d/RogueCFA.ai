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

async function cleanBadDigests() {
  console.log('=== CLEANING BAD DIGESTS FOR JULY 29 IN SUPABASE ===');

  const { data, error } = await supabase
    .from('digest_jobs')
    .delete()
    .eq('episode_date', '2026-07-29')
    .select();

  if (error) {
    console.error('Delete error:', error.message);
  } else {
    console.log(`Deleted ${data?.length || 0} stale jobs for 2026-07-29 from Supabase!`);
  }
}

cleanBadDigests();
