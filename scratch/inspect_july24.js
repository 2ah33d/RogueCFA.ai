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

async function main() {
  const { data: jobs } = await supabase
    .from('digest_jobs')
    .select('*')
    .in('episode_date', ['2026-07-24', '2026-07-23']);

  console.log('Jobs for July 23 and July 24:');
  for (const j of jobs || []) {
    console.log(`\nID: ${j.id}`);
    console.log(`Episode Date: ${j.episode_date}`);
    console.log(`Video ID: ${j.video_id}`);
    console.log(`Video Title: ${j.video_title}`);
    console.log(`Guest in digest: ${j.result?.digest?.guest}`);
    console.log(`Firm: ${j.result?.digest?.firm}`);
  }
}

main().catch(console.error);
