import fs from 'fs';

const html = fs.readFileSync('scratch/bnn_live_raw.html', 'utf8');

// Search for any 9c9media or bell media URLs or video player IDs
const urls = html.match(/https?:\/\/[^"'\s\\]+/gi) || [];
const mediaUrls = urls.filter(u => u.includes('9c9') || u.includes('media') || u.includes('video') || u.includes('live') || u.includes('stream') || u.includes('player'));

console.log('Media related URLs found:', mediaUrls.slice(0, 30));

// Check scripts or inline json
const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
console.log('Inline script count:', scripts.length);
scripts.forEach((s, idx) => {
  if (s.includes('player') || s.includes('video') || s.includes('live') || s.includes('stream') || s.includes('9c9')) {
    console.log(`Script #${idx} snippet:`, s.slice(0, 300));
  }
});
