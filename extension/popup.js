document.addEventListener('DOMContentLoaded', async () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const extractBtn = document.getElementById('extractBtn');
  const statusDiv = document.getElementById('status');
  const videoInfoSection = document.getElementById('videoInfoSection');
  const videoTitleEl = document.getElementById('videoTitle');

  /* Load stored URL (default to localhost for dev or vercel app URL) */
  const stored = await chrome.storage.local.get(['roguecfa_url']);
  apiUrlInput.value = stored.roguecfa_url || 'http://localhost:5173';

  apiUrlInput.addEventListener('change', () => {
    let val = apiUrlInput.value.trim();
    if (val.endsWith('/')) val = val.slice(0, -1);
    chrome.storage.local.set({ roguecfa_url: val });
  });

  /* Check active tab */
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url?.includes('youtube.com/watch')) {
    statusDiv.textContent = 'Please open a BNN Bloomberg MarketCall video on YouTube.';
    statusDiv.className = 'error';
    extractBtn.disabled = true;
    return;
  }

  videoInfoSection.style.display = 'block';
  videoTitleEl.textContent = tab.title?.replace(' - YouTube', '') || 'YouTube Video';

  extractBtn.addEventListener('click', async () => {
    extractBtn.disabled = true;
    statusDiv.textContent = 'Extracting transcript from page...';
    statusDiv.className = 'info';

    try {
      /* Send message to content script to extract transcript */
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_TRANSCRIPT' }, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(res);
          }
        });
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to extract captions.');
      }

      statusDiv.textContent = 'Transcript extracted! Sending to RogueCFA...';

      let baseUrl = apiUrlInput.value.trim();
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      const endpoint = `${baseUrl}/api/marketcall-digest`;

      /* Fetch stored keys from local storage or ask user if needed */
      const payload = {
        transcript: response.data.transcript,
        videoId: response.data.videoId,
        videoTitle: response.data.videoTitle,
        episodeDate: response.data.episodeDate,
        /* Pass standard provider if configured */
        provider: 'gemini',
      };

      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!apiRes.ok) {
        const errJson = await apiRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${apiRes.status}`);
      }

      const result = await apiRes.json();
      if (result.error) {
        throw new Error(result.message || result.error);
      }

      statusDiv.textContent = '✅ Success! Open your RogueCFA app to view the fresh digest.';
      statusDiv.className = 'success';
    } catch (err) {
      statusDiv.textContent = `❌ ${err.message}`;
      statusDiv.className = 'error';
      extractBtn.disabled = false;
    }
  });
});
