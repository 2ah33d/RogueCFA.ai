import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

async function checkSupabase() {
  const { supabase } = await import('../api/_supabaseClient.js');
  const { data, error } = await supabase
    .from('digest_jobs')
    .select('id, episode_date, video_id, video_title, status, created_at')
    .order('episode_date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Supabase Error:', error);
    return;
  }

  console.log('Recent Supabase digest_jobs rows:');
  console.table(data);
}

checkSupabase();
