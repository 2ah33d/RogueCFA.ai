async function inspectAllStreamsInFusion() {
  const url = 'https://www.bnnbloomberg.ca/video/shows/market-call/2026/07/29/tim-regans-top-picks-brookfield-corp-allegion-plc-thomson-reuters/';
  console.log(`=== RECURSIVELY SEARCHING FUSION GLOBAL CONTENT FOR ALL STREAMS ===`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) return;
    const html = await res.text();

    const startMarker = 'Fusion.globalContent=';
    const startIdx = html.indexOf(startMarker);
    if (startIdx !== -1) {
      const endIdx = html.indexOf('};', startIdx);
      const jsonStr = html.slice(startIdx + startMarker.length, endIdx + 1);
      const data = JSON.parse(jsonStr);

      function searchObj(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        for (const [key, val] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (key === 'streams' || key === 'stream_url' || key === 'url' || key === 'files' || key === 'video') {
            if (typeof val === 'string' && (val.includes('.mp4') || val.includes('.m3u8'))) {
              console.log(`FOUND STREAM [${currentPath}]: ${val}`);
            } else if (Array.isArray(val)) {
              console.log(`FOUND STREAMS ARRAY [${currentPath}] (${val.length} items):`, JSON.stringify(val, null, 2));
            }
          }
          if (typeof val === 'object') {
            searchObj(val, currentPath);
          }
        }
      }

      searchObj(data);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

inspectAllStreamsInFusion();
