import { execSync } from 'child_process';

async function testMap() {
  const masterUrl = 'https://live-news.video.9c9media.com/f/news/bnnbloomberg/manifest.m3u8';
  
  // 1. Fetch master playlist to inspect variant sub-playlists
  const res = await fetch(masterUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': 'https://www.bnnbloomberg.ca/'
    }
  });
  const text = await res.text();
  console.log('Master manifest content:\n', text);
}

testMap();
