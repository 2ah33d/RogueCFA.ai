import fs from 'fs';

const html = fs.readFileSync('scratch/bnn_live_raw.html', 'utf8');
const script24 = html.match(/window\.Fusion=[\s\S]+?<\/script>/)[0];
fs.writeFileSync('scratch/fusion_script_full.txt', script24);
console.log('Saved script 24 full, length:', script24.length);

// Look for 9c9, videoId, live, stream, m3u8, feed, player
const matches = script24.match(/["'](http[^"']+)["']/g) || [];
console.log('URLs in script 24:', matches.slice(0, 30));
