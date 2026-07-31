import { supabase } from '../api/supabaseClient.js';

async function testHistoryQuery() {
  console.log('=== TESTING SUPABASE HISTORY QUERY ===');
  try {
    const { data, error } = await supabase
      .from('digest_jobs')
      .select('id, episode_date, video_id, video_title, result, created_at, updated_at')
      .eq('status', 'complete')
      .eq('is_debug', false)
      .not('result', 'is', null)
      .order('episode_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Error:', error);
    } else {
      console.log(`Success! Fetched ${data.length} rows.`);
      for (const r of data.slice(0, 5)) {
        console.log(`  - Date: ${r.episode_date} | Guest: ${r.result?.digest?.guest}`);
      }
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

testHistoryQuery();
