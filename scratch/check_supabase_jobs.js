import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zyikdxfwvgvuvgvwxwnx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.s6y';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase
    .from('digest_jobs')
    .select('*')
    .limit(20);

  if (error) {
    console.error('Error fetching digest_jobs:', error.message);
  } else {
    console.log(`Found ${data.length} digest_jobs rows:`);
    for (const r of data) {
      console.log(`ID: ${r.id} | Date: ${r.episode_date} | Status: ${r.status} | is_debug: ${r.is_debug} | Guest: ${r.result?.digest?.guest}`);
    }
  }
}

main();
