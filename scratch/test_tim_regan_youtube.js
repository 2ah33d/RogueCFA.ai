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

const youtubeKey = process.env.CRON_YOUTUBE_KEY || process.env.YOUTUBE_API_KEY || '';

async function testTimReganYoutube() {
  console.log('=== SEARCHING YOUTUBE FOR TIM REGAN JULY 29 VIDEO ===');
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=Market%20Call%20Tim%20Regan&type=video&order=date&maxResults=5&key=${youtubeKey}`;

  try {
    const res = await fetch(searchUrl);
    if (!res.ok) {
      console.error('YouTube search error:', res.status, res.statusText);
      return;
    }

    const data = await res.json();
    const items = data.items || [];
    console.log(`Found ${items.length} YouTube videos for Tim Regan:`);

    for (const v of items) {
      const vId = v.id?.videoId;
      const title = v.snippet?.title;
      const pubDate = v.snippet?.publishedAt;
      console.log(`\nVideo ID: ${vId} | Date: ${pubDate} | Title: ${title}`);

      if (vId) {
        const transcript = await fetchTranscript(vId);
        console.log(`  Transcript Length: ${transcript ? transcript.length : 0} chars`);
        if (transcript && transcript.length >= 200) {
          console.log(`  Snippet: "${transcript.slice(0, 200)}..."`);
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testTimReganYoutube();
