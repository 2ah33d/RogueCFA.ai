import fs from 'fs';

const html = fs.readFileSync('scratch/bnn_live_raw.html', 'utf8');

const fusionMatch = html.match(/Fusion\.globalContent\s*=\s*(\{[\s\S]+?\});\s*Fusion\./i) || html.match(/id="fusion-metadata"[^>]*>([\s\S]+?)<\/script>/i);

if (fusionMatch) {
  const content = fusionMatch[1];
  fs.writeFileSync('scratch/fusion_metadata.txt', content);
  console.log('Saved fusion metadata, length:', content.length);

  // Search inside for urls, video, stream, m3u8, 9c9media
  const matches = content.match(/https?:\/\/[^"'\s\\]+/gi) || [];
  console.log('URLs in Fusion metadata:', matches);
} else {
  console.log('Fusion metadata script not found directly');
}
