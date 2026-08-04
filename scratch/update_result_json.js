import fs from 'fs';
import path from 'path';

// Read .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }
}

async function updateResultVideoIds() {
  const { supabase } = await import('../api/_supabaseClient.js');

  const { data: rows } = await supabase
    .from('digest_jobs')
    .select('id, episode_date, video_id, result')
    .eq('status', 'complete');

  for (const row of rows || []) {
    if (row.video_id && row.result) {
      if (row.result.videoId !== row.video_id) {
        const updatedResult = { ...row.result, videoId: row.video_id };
        await supabase
          .from('digest_jobs')
          .update({ result: updatedResult })
          .eq('id', row.id);
        console.log(`Updated result.videoId for ${row.id} (${row.episode_date}) to ${row.video_id}`);
      }
    }
  }
}

updateResultVideoIds();
