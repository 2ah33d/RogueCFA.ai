import { fetchYoutubeAudioMedia } from '../api/_youtubeFetcher.js';

async function testYoutubeFetcherLive() {
  process.env.YT_DLP_WORKER_URL = 'https://ah33d--ytdlp-worker-fastapi-app.modal.run/extract';
  console.log('=== TESTING fetchYoutubeAudioMedia LIVE WITH MODAL WORKER ===');

  const media = await fetchYoutubeAudioMedia();
  if (media && media.streamUrl) {
    console.log('SUCCESS! Retrieved media object:');
    console.log('  - Title:', media.videoTitle);
    console.log('  - Video ID:', media.videoId);
    console.log('  - Episode Date:', media.episodeDate);
    console.log('  - Stream URL:', media.streamUrl.substring(0, 100) + '...');
  } else {
    console.error('FAILED! media object:', media);
  }
}

testYoutubeFetcherLive();
