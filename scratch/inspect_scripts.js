import fs from 'fs';

const html = fs.readFileSync('scratch/bnn_live_raw.html', 'utf8');

// Find all script tags
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let i = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  i++;
  const scriptContent = match[1];
  if (scriptContent.includes('Fusion') || scriptContent.includes('video') || scriptContent.includes('9c9') || scriptContent.includes('live')) {
    console.log(`--- SCRIPT ${i} ---`);
    console.log(scriptContent.slice(0, 500));
  }
}
