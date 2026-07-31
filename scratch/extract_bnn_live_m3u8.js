import fs from 'fs';

async function extractM3U8() {
  try {
    const res = await fetch('https://www.bnnbloomberg.ca/video/live', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const html = await res.text();
    fs.writeFileSync('scratch/bnn_live_raw.html', html);
    console.log('Saved raw HTML, size:', html.length);

    // Search for m3u8 or player embeds
    const matches = html.match(/https?:\/\/[^"'\s\\]+?\.m3u8[^"'\s\\]*/gi) || [];
    console.log('Direct m3u8 matches:', matches);

    // Search for player scripts or iframe embeds
    const iframes = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi) || [];
    console.log('Iframes:', iframes);

    const scriptSrcs = html.match(/src=["']([^"']+\.js[^"']*)["']/gi) || [];
    console.log('Script count:', scriptSrcs.length);

    // Search for config object or JSON blobs in scripts
    const jsonBlobs = html.match(/window\.__[A-Za-z0-9_]+\s*=\s*(\{.+?\});/gi) || [];
    console.log('JSON blobs:', jsonBlobs.length);
  } catch (err) {
    console.error('Error:', err);
  }
}

extractM3U8();
