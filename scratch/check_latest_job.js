import { supabase } from '../api/supabaseClient.js';

async function checkLatestJob() {
  console.log('=== CHECKING LATEST SUPABASE DIGEST JOB ===');
  try {
    const { data, error } = await supabase
      .from('digest_jobs')
      .select('id, status, episode_date, video_title, result, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Supabase error:', error.message);
      return;
    }

    console.log(`Found ${data.length} job(s):`);
    for (const job of data) {
      console.log(`\n- ID: ${job.id}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Episode Date: ${job.episode_date}`);
      console.log(`  Video Title: ${job.video_title}`);
      console.log(`  Created At: ${job.created_at}`);
      if (job.result?.digest) {
        console.log(`  Guest: ${job.result.digest.guest}`);
        console.log(`  Picks Count: ${job.result.digest.picks?.length || 0}`);
      }
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

checkLatestJob();
