import fs from 'fs';

async function testDownload() {
  const url = 'https://dts.podtrac.com/redirect.mp3/traffic.omny.fm/d/clips/4809bc8a-e41a-405c-93da-a8cf011df2f4/fcfd42e4-d5c6-4b4a-8c62-ae32016f1b9a/b7d0af11-d538-40e5-92a0-b497014982ad/audio.mp3';
  console.log('Downloading official BNN Market Call episode MP3...');
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync('scratch/test_episode.mp3', Buffer.from(buffer));
  console.log('Downloaded successfully! File size:', (buffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
}

testDownload();
