/**
 * RogueCFA MarketCall Content Script
 * Runs inside the user's browser on YouTube video pages.
 * Because this runs from your personal residential browser, YouTube serves
 * the caption track list and timedtext endpoints cleanly without bot blocks.
 */

/* Listen for requests from the popup */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_TRANSCRIPT') {
    extractTranscriptFromPage()
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; /* Keep message channel open for async response */
  }
});

async function extractTranscriptFromPage() {
  /* 1. Extract video metadata from URL and DOM */
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');
  if (!videoId) {
    throw new Error('Not on a YouTube video page. Please open a BNN Bloomberg MarketCall video first.');
  }

  const titleEl = document.querySelector('h1.ytd-watch-metadata') || document.querySelector('h1.title');
  const videoTitle = titleEl ? titleEl.innerText.trim() : document.title.replace(' - YouTube', '');

  /* 2. Try grabbing ytInitialPlayerResponse from page variables or embedded scripts */
  let playerResponse = null;
  try {
    if (window.ytInitialPlayerResponse) {
      playerResponse = window.ytInitialPlayerResponse;
    } else {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const s of scripts) {
        if (s.textContent && s.textContent.includes('ytInitialPlayerResponse = ')) {
          const match = s.textContent.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
          if (match) {
            playerResponse = JSON.parse(match[1]);
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not parse ytInitialPlayerResponse directly, trying fetch fallback');
  }

  /* 3. Locate caption tracks */
  let captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  /* If not found in DOM variables, fetch the video page HTML directly from browser context */
  if (!captionTracks || !Array.isArray(captionTracks) || captionTracks.length === 0) {
    const pageRes = await fetch(window.location.href);
    const html = await pageRes.text();
    const captionsMatch = html.match(/"captions":\s*(\{.*?"playerCaptionsTracklistRenderer".*?\})\s*,\s*"videoDetails"/s);
    if (captionsMatch) {
      try {
        const parsed = JSON.parse(captionsMatch[1]);
        captionTracks = parsed?.playerCaptionsTracklistRenderer?.captionTracks;
      } catch (e) {
        /* ignore */
      }
    }
  }

  if (!captionTracks || !Array.isArray(captionTracks) || captionTracks.length === 0) {
    throw new Error('No closed captions or auto-generated subtitles found for this video. YouTube may still be processing auto-captions.');
  }

  /* Prefer English ASR or English track */
  const track = captionTracks.find((t) => t.languageCode === 'en' && t.kind === 'asr') ||
                captionTracks.find((t) => t.languageCode === 'en') ||
                captionTracks[0];

  if (!track?.baseUrl) {
    throw new Error('Could not extract caption URL.');
  }

  /* 4. Fetch the timedtext JSON directly from browser (no datacenter blocks!) */
  const captionUrl = track.baseUrl + '&fmt=json3';
  const res = await fetch(captionUrl);
  if (!res.ok) {
    throw new Error(`YouTube timedtext server returned status ${res.status}`);
  }

  const captionData = await res.json();
  const events = captionData?.events || [];

  const segments = [];
  for (const event of events) {
    if (event.segs) {
      const text = event.segs.map((s) => s.utf8 || '').join('');
      if (text.trim()) {
        segments.push(text);
      }
    }
  }

  const fullText = segments.join(' ');
  if (fullText.length < 100) {
    throw new Error('Extracted transcript was empty or too short.');
  }

  return {
    videoId,
    videoTitle,
    episodeDate: new Date().toISOString().split('T')[0],
    transcript: fullText,
  };
}
