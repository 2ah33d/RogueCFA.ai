import { execSync } from 'child_process';

try {
  console.log('Testing FFmpeg audio capture from HLS manifest.m3u8...');
  const cmd = `ffmpeg -y -headers "Referer: https://www.bnnbloomberg.ca/\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n" -i "https://live-news.video.9c9media.com/f/news/bnnbloomberg/manifest.m3u8" -t 10 -vn -c:a copy scratch/test_audio.m4a`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('SUCCESS! Test audio captured cleanly to scratch/test_audio.m4a');
} catch (err) {
  console.error('FFmpeg failed:', err.message);
}
