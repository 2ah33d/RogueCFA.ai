import fs from 'fs';
import { findRecentMarketCallVideos, fetchTranscript } from '../api/_pipeline.js';

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

const youtubeKey = process.env.CRON_YOUTUBE_KEY || process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || '';

async function testYouTubeCaptions() {
  console.log('=== TESTING YOUTUBE CAPTION FETCHING FOR RECENT EPISODES ===');
  console.log('Using YouTube Key:', youtubeKey ? `${youtubeKey.slice(0, 8)}...` : 'NONE');

  if (!youtubeKey) {
    console.error('Missing YouTube key in env');
    return;
  }

  const timer = { start: () => {}, end: () => {} };
  const videos = await findRecentMarketCallVideos(youtubeKey, timer);
  console.log(`\nFound ${videos.length} recent candidate videos from YouTube API:`);

  for (const v of videos) {
    console.log(`\nVideo ID: ${v.videoId} | Date: ${v.episodeDate} | Title: ${v.videoTitle}`);
    try {
      const transcript = await fetchTranscript(v.videoId);
      console.log(`  Caption Result Length: ${transcript ? transcript.length : 0} chars`);
      if (transcript && transcript.length >= 200) {
        console.log(`  Caption Snippet: "${transcript.slice(0, 150)}..."`);
      } else {
        console.log(`  Caption Status: Empty / Unavailable`);
      }
    } catch (err) {
      console.log(`  Caption Fetch Error: ${err.message}`);
    }
  }
}

testYouTubeCaptions();
