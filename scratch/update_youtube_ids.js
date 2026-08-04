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

async function updateVideoIds() {
  const { supabase } = await import('../api/_supabaseClient.js');

  const updates = [
    { episode_date: '2026-07-31', video_id: '8bdGzQeMeXg', video_title: "Market Call: Brianne Gardner's outlook on Canadian & U.S. Large Caps (July 31, 2026)" },
    { episode_date: '2026-07-30', video_id: 't9tVejBUgz8', video_title: "Market Call: Kim Bolton's outlook on Technology Stocks (July 30, 2026)" },
    { episode_date: '2026-07-29', video_id: 'hPQAsdLiX_M', video_title: "Market Call: Tim Regan's outlook on North American Large Caps (July 29, 2026)" },
  ];

  for (const item of updates) {
    console.log(`Updating ${item.episode_date} -> video_id: ${item.video_id}...`);
    
    // Update digest_jobs table
    const { data, error } = await supabase
      .from('digest_jobs')
      .update({ video_id: item.video_id, video_title: item.video_title })
      .eq('episode_date', item.episode_date);

    if (error) {
      console.error(`Failed to update ${item.episode_date}:`, error.message);
    } else {
      console.log(`Successfully updated ${item.episode_date}`);
    }
  }
}

updateVideoIds();
