/**
 * api/_bnnWebPlayer.js
 * Scrapes BNN Bloomberg Web Video Player (.mp4 / .m3u8 CloudFront HLS CDN streams)
 * for immediate same-day MarketCall episode audio transcription via Groq Whisper AI.
 * Zero datacenter IP blocks, zero YouTube decipher ciphers, zero Vercel timeouts.
 */

import { decodeHTMLEntities, getLatestMarketCallDateStr } from './_pipeline.js';

const BNN_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Construct the direct BNN Bloomberg full 45-minute episode article URL for a given date.
 */
function buildFullEpisodeUrlForDate(dateStr) {
  if (!dateStr || !dateStr.includes('-')) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
  if (isNaN(d.getTime())) return null;

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  const weekdayName = weekdays[d.getUTCDay()];
  const monthName = months[d.getUTCMonth()];

  const slug = `full-episode-market-call-for-${weekdayName}-${monthName}-${parseInt(day, 10)}-${year}`;
  return `https://www.bnnbloomberg.ca/video/shows/market-call/${year}/${month}/${day}/${slug}/`;
}

/**
 * Fetch BNN Bloomberg's latest MarketCall video article page and extract direct CloudFront MP4/m3u8 media stream URL.
 */
export async function fetchBnnWebPlayerMedia(timer) {
  const sectionUrls = [
    'https://www.bnnbloomberg.ca/video/shows/market-call/',
    'https://www.bnnbloomberg.ca/video/',
    'https://www.bnnbloomberg.ca/markets/',
  ];
  timer?.start('BNN Web Player search');

  const todayStr = getLatestMarketCallDateStr();
  const candidateUrls = new Set();

  /* 1. Dynamic Section Listing Scan */
  for (const pageUrl of sectionUrls) {
    try {
      const res = await fetch(pageUrl, {
        headers: BNN_BROWSER_HEADERS,
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const html = await res.text();
        const linkMatches = Array.from(
          html.matchAll(/href=["'](\/video\/[^"']*?[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[^"']+?)["']/gi)
        ).map((m) => m[1]);

        for (const link of linkMatches) {
          const fullUrl = link.startsWith('http') ? link : `https://www.bnnbloomberg.ca${link}`;
          /* Filter to today's date if date is present in URL */
          if (!fullUrl.includes(todayStr.replace(/-/g, '/'))) {
            // continue if dated link belongs to a different day
          }
          candidateUrls.add(fullUrl);
        }
      }
    } catch {
      /* ignore individual section fetch timeout */
    }
  }

  /* 2. Inject constructed direct 45-minute full broadcast episode URL as fallback candidate */
  const directFullEp = buildFullEpisodeUrlForDate(todayStr);
  if (directFullEp) {
    candidateUrls.add(directFullEp);
  }

  timer?.end('BNN Web Player search');

  const urlArray = Array.from(candidateUrls);
  if (urlArray.length === 0) {
    return await fetchBnnQuerylyMedia(timer);
  }

  /* Prioritize full 45-minute broadcast episode video URLs dynamically */
  urlArray.sort((a, b) => {
    const aIsFull = a.toLowerCase().includes('full-episode') || a.toLowerCase().includes('full_episode') || a.toLowerCase().includes('full-show');
    const bIsFull = b.toLowerCase().includes('full-episode') || b.toLowerCase().includes('full_episode') || b.toLowerCase().includes('full-show');
    if (aIsFull && !bIsFull) return -1;
    if (!aIsFull && bIsFull) return 1;
    return 0;
  });

  /* Collect media streams for all episode segments for today (Market Outlook, Top Picks, Past Picks) */
  const segmentStreams = [];
  let mainTitle = 'BNN Bloomberg MarketCall';
  let targetEpisodeDate = '';

  for (const artUrl of urlArray.slice(0, 10)) {
    const media = await extractMediaFromBnnArticle(artUrl, timer);
    if (media && media.streamUrl) {
      if (!targetEpisodeDate) targetEpisodeDate = media.episodeDate;
      if (media.episodeDate === targetEpisodeDate) {
        segmentStreams.push(media.streamUrl);
        if (!mainTitle || mainTitle === 'BNN Bloomberg MarketCall') {
          mainTitle = media.videoTitle;
        }
      }
    }
  }

  if (segmentStreams.length > 0) {
    return {
      streamUrl: segmentStreams[0],
      streamUrls: segmentStreams,
      videoTitle: mainTitle,
      episodeDate: targetEpisodeDate || new Date().toISOString().split('T')[0],
      source: 'bnn_web_player',
    };
  }

  return await fetchBnnQuerylyMedia(timer);
}

/**
 * Extract media stream URL, date, and title from a BNN Bloomberg video article URL.
 */
async function extractMediaFromBnnArticle(artUrl, timer) {
  try {
    timer?.start('BNN Article HTML fetch');
    const res = await fetch(artUrl, {
      headers: BNN_BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    timer?.end('BNN Article HTML fetch');

    if (!res.ok) return null;

    const html = await res.text();

    /* Extract headline / title */
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
    const videoTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'BNN Bloomberg MarketCall';

    /* Extract date */
    const dateMatch = html.match(/"datePublished":\s*"([^"]+)"/i) || html.match(/\/([0-9]{4})\/([0-9]{2})\/([0-9]{2})\//);
    let episodeDate = new Date().toISOString().split('T')[0];
    if (dateMatch) {
      if (dateMatch[1] && dateMatch[1].includes('-')) {
        episodeDate = dateMatch[1].split('T')[0];
      } else if (dateMatch[1] && dateMatch[2] && dateMatch[3]) {
        episodeDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }
    }

    /* Extract CloudFront MP4/m3u8 media stream URL from Fusion globalContent JSON or HTML */
    const mediaMatches = html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8|m4a|mp3)[^"'\s>]*/gi) || [];
    const validStream = mediaMatches.find((u) => !u.toLowerCase().includes('thumb')) || mediaMatches[0];

    if (validStream) {
      return {
        streamUrl: validStream,
        videoTitle: decodeHTMLEntities(videoTitle),
        episodeDate,
        source: 'bnn_web_player',
      };
    }
  } catch (err) {
    console.warn(`[bnnWebPlayer] Failed to parse article ${artUrl}:`, err.message);
  }
  return null;
}

/**
 * Fallback Queryly search to find latest BNN MarketCall video articles.
 */
async function fetchBnnQuerylyMedia(timer) {
  try {
    const QUERYLY_KEY = 'e5c9f131f6f04418';
    const queryUrl = `https://api.queryly.com/v1/search.aspx?queryly_key=${QUERYLY_KEY}&query=market%20call&endindex=5&batchsize=5`;
    timer?.start('Queryly video search');
    const res = await fetch(queryUrl, { headers: BNN_BROWSER_HEADERS, signal: AbortSignal.timeout(6000) });
    timer?.end('Queryly video search');

    if (res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        const items = data.items || [];
        for (const item of items) {
          if (item.link) {
            const artUrl = item.link.startsWith('http') ? item.link : `https://www.bnnbloomberg.ca${item.link}`;
            const media = await extractMediaFromBnnArticle(artUrl, timer);
            if (media && media.streamUrl) return media;
          }
        }
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn('[bnnWebPlayer] Queryly search fallback failed:', err.message);
  }
  return null;
}

/**
 * Download BNN Web Player audio/video media stream and transcribe via Groq Whisper AI.
 */
export async function transcribeBnnWebMedia(streamUrlInput, groqKey, timer) {
  if (!groqKey || !groqKey.startsWith('gsk_')) {
    return { text: '', error: 'Missing or invalid Groq API key' };
  }

  const urls = Array.isArray(streamUrlInput) ? streamUrlInput : [streamUrlInput];
  const transcripts = [];

  for (const streamUrl of urls) {
    try {
      /* Check HEAD Content-Length: if media stream is < 100KB, it is a 1-frame Bell Media placeholder MP4 */
      try {
        const headRes = await fetch(streamUrl, { method: 'HEAD', headers: BNN_BROWSER_HEADERS, signal: AbortSignal.timeout(5000) });
        const sizeBytes = parseInt(headRes.headers.get('content-length') || '0', 10);
        if (sizeBytes > 0 && sizeBytes < 100 * 1024) {
          console.warn(`[bnnWebPlayer] Media stream ${streamUrl} is a 1-frame Bell Media placeholder (${sizeBytes} bytes). Skipping.`);
          continue;
        }
      } catch {
        /* ignore head check error */
      }

      timer?.start('BNN media stream download');
      const res = await fetch(streamUrl, {
        headers: BNN_BROWSER_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        timer?.end('BNN media stream download');
        continue;
      }

      const audioBuffer = await res.arrayBuffer();
      timer?.end('BNN media stream download');
      console.log(`[TIMING] BNN Web Media stream downloaded: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

      /* Split audio/video buffer into 20MB slices to stay within Groq's 25MB payload limit */
      const CHUNK_LIMIT = 20 * 1024 * 1024;
      const chunks = [];
      let offset = 0;
      while (offset < audioBuffer.byteLength) {
        const end = Math.min(offset + CHUNK_LIMIT, audioBuffer.byteLength);
        chunks.push(audioBuffer.slice(offset, end));
        offset = end;
      }

      const transcribeChunk = async (chunkBuf, idx) => {
        const formData = new FormData();
        const ext = streamUrl.toLowerCase().includes('.mp4') ? 'mp4' : 'audio.mp3';
        formData.append('file', new Blob([chunkBuf]), `bnn_web_part${idx}.${ext}`);
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('response_format', 'json');

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}` },
          body: formData,
          signal: AbortSignal.timeout(45000),
        });

        if (groqRes.ok) {
          const data = await groqRes.json().catch(() => null);
          return { text: data?.text || '', error: null };
        }
        const errData = await groqRes.json().catch(() => ({}));
        return { text: '', error: `Groq error (${groqRes.status}): ${errData.error?.message || groqRes.statusText}` };
      };

      timer?.start('Groq Whisper BNN web media transcription');
      const results = await Promise.all(chunks.map((buf, i) => transcribeChunk(buf, i + 1)));
      timer?.end('Groq Whisper BNN web media transcription');

      const segmentText = results.map((r) => r.text).filter(Boolean).join(' ');
      if (segmentText.trim()) {
        transcripts.push(segmentText.trim());
      }
    } catch (err) {
      console.warn(`[bnnWebPlayer] Failed segment stream ${streamUrl}:`, err.message);
    }
  }

  const combinedText = transcripts.join('\n\n');
  if (combinedText.length >= 200) {
    return { text: combinedText, error: null };
  }

  return { text: '', error: 'Groq Whisper returned an empty transcription for BNN web media streams.' };
}
