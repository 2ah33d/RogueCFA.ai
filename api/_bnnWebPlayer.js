/**
 * api/_bnnWebPlayer.js
 * Scrapes BNN Bloomberg Web Video Player (.mp4 / .m3u8 CloudFront HLS CDN streams)
 * for immediate same-day MarketCall episode audio transcription via Groq Whisper AI.
 * Zero datacenter IP blocks, zero YouTube decipher ciphers, zero Vercel timeouts.
 */

import { decodeHTMLEntities } from './_pipeline.js';

const BNN_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Fetch BNN Bloomberg's latest MarketCall video article page and extract direct CloudFront MP4/m3u8 media stream URL.
 */
export async function fetchBnnWebPlayerMedia(timer) {
  const sectionUrls = [
    'https://www.bnnbloomberg.ca/video/',
    'https://www.bnnbloomberg.ca/markets/',
    'https://www.bnnbloomberg.ca/video/shows/market-call/',
  ];
  timer?.start('BNN Web Player search');

  const candidateUrls = new Set();

  for (const pageUrl of sectionUrls) {
    try {
      const res = await fetch(pageUrl, {
        headers: BNN_BROWSER_HEADERS,
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const html = await res.text();
        const linkMatches = Array.from(
          html.matchAll(/href=["'](\/(?:video\/shows\/market-call|markets)\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[^"']+?)["']/gi)
        ).map((m) => m[1]);

        for (const link of linkMatches) {
          const fullUrl = link.startsWith('http') ? link : `https://www.bnnbloomberg.ca${link}`;
          candidateUrls.add(fullUrl);
        }
      }
    } catch {
      /* ignore individual section fetch timeout */
    }
  }

  timer?.end('BNN Web Player search');

  const urlArray = Array.from(candidateUrls);
  if (urlArray.length === 0) {
    return await fetchBnnQuerylyMedia(timer);
  }

  /* Try candidate video article URLs for today's media stream */
  for (const artUrl of urlArray.slice(0, 5)) {
    const media = await extractMediaFromBnnArticle(artUrl, timer);
    if (media && media.streamUrl) {
      return media;
    }
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

    /* Strictly ignore temporary promo placeholder clips (Placeholder.mp4) */
    const validStream = mediaMatches.find(
      (u) => !u.toLowerCase().includes('placeholder') && !u.toLowerCase().includes('promo') && !u.toLowerCase().includes('thumb')
    );

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
export async function transcribeBnnWebMedia(streamUrl, groqKey, timer) {
  if (!groqKey || !groqKey.startsWith('gsk_')) {
    return { text: '', error: 'Missing or invalid Groq API key' };
  }

  try {
    timer?.start('BNN media stream download');
    const res = await fetch(streamUrl, {
      headers: BNN_BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      timer?.end('BNN media stream download');
      return { text: '', error: `BNN media CDN returned HTTP ${res.status}` };
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

    const combinedText = results.map((r) => r.text).filter(Boolean).join('\n\n');
    if (combinedText.length >= 200) {
      return { text: combinedText, error: null };
    }

    return { text: '', error: 'Groq Whisper returned an empty transcription for BNN web media stream.' };
  } catch (err) {
    return { text: '', error: `BNN Web Media transcription exception: ${err.message}` };
  }
}
