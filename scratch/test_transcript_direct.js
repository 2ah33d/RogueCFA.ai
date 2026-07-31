import { fetchTranscript } from '../api/_pipeline.js';

async function testTranscriptDirect() {
  console.log('=== TESTING DIRECT YOUTUBE CAPTION FETCHING ===');

  // Queryly / YouTube video IDs from BNN MarketCall channel
  const sampleVideoIds = [
    '2Vv-BfVoq4g',
    '3416829',
    'M7lc1UVf-VE',
  ];

  for (const vId of sampleVideoIds) {
    console.log(`\nTesting Video ID: ${vId}`);
    try {
      const transcript = await fetchTranscript(vId);
      console.log(`  Result Length: ${transcript ? transcript.length : 0} chars`);
      if (transcript && transcript.length >= 200) {
        console.log(`  Snippet: "${transcript.slice(0, 150)}..."`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

testTranscriptDirect();
