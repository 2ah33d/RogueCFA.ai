/**
 * api/_bnnScraper.js
 * Zero-LLM Cheerio / HTML DOM / Regex parser for BNN Bloomberg Past Picks articles.
 * Strictly zero LLM tokens burned.
 */

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const QUERYLY_KEY = 'e5c9f131f6f04418';

/**
 * Clean & normalize analyst name for deduplication/matching
 * e.g., "Greg Newman, Senior Wealth Advisor, ScotiaMcLeod" -> "Greg Newman"
 */
export function normalizeAnalystName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  let cleaned = rawName
    .split(/,|\s+-\s+|\s+–\s+|\s+—\s+/)[0] // Take name before firm/title comma
    .replace(/^(by|guest|analyst):?\s+/i, '')
    .replace(/\s+(Senior|Portfolio|Wealth|Advisor|Manager|Managing|Director|Vice|President|Chief|VP|CEO).*$/i, '')
    .trim();
  return cleaned;
}

/**
 * Convert arbitrary date text (e.g. "OCT. 27, 2025", "July 23, 2026") into YYYY-MM-DD
 */
export function parseDateToIso(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const cleanedStr = dateStr.replace(/\./g, '').trim();
  const d = new Date(cleanedStr);
  if (isNaN(d.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return d.toISOString().split('T')[0];
}

/**
 * Search BNN Bloomberg for an analyst's past "past picks" articles via Queryly API
 * @param {string} analystName
 * @param {number} limit - Number of recent articles to scrape (config value, default 3)
 * @returns {Promise<Array<{ url: string, title: string, pubdate: string }>>}
 */
export async function searchBnnPastPicks(analystName, limit = 3) {
  const cleanName = normalizeAnalystName(analystName);
  if (!cleanName) return [];

  const query = `${cleanName} past picks`;
  const searchUrl = `https://api.queryly.com/json.aspx?queryly_key=${QUERYLY_KEY}&query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(`[bnnScraper] Queryly returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items = data.items || [];
    const matched = [];
    const seenUrls = new Set();

    for (const item of items) {
      if (!item || !item.link) continue;
      let fullUrl = item.link.startsWith('/') ? `https://www.bnnbloomberg.ca${item.link}` : item.link;

      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      const title = item.title || '';
      /* Only keep articles that review past picks or top picks */
      if (/past\s+picks|top\s+picks/i.test(title) || /past\s+picks/i.test(fullUrl)) {
        matched.push({
          url: fullUrl,
          title,
          pubdate: item.pubdate || '',
        });
        if (matched.length >= limit) break;
      }
    }

    return matched;
  } catch (err) {
    console.warn('[bnnScraper] Search failed:', err.message);
    return [];
  }
}

/**
 * Zero-LLM Extraction: Parse past picks review tables from a BNN article HTML
 * @param {string} html - Raw HTML of BNN article
 * @param {string} sourceUrl - Article source URL
 * @param {string} [fallbackAnalystName] - Fallback analyst name
 * @returns {Array<Object>} Structured rows for analyst_track_record
 */
export function parseBnnPastPicksArticle(html, sourceUrl, fallbackAnalystName = '') {
  if (!html || typeof html !== 'string') return [];

  /* Extract article body text from JSON-LD schema or raw text */
  let articleText = '';
  const jsonLdMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const script of jsonLdMatch) {
      if (script.includes('AnalysisNewsArticle') || script.includes('NewsArticle')) {
        try {
          const content = script.replace(/<[^>]+>/g, '');
          const parsed = JSON.parse(content);
          if (parsed.articleBody) {
            articleText = parsed.articleBody;
            break;
          }
        } catch {
          /* continue */
        }
      }
    }
  }

  /* Fallback: Strip HTML tags to get raw body text */
  if (!articleText || articleText.length < 100) {
    articleText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /* Extract Analyst Name from article body if available */
  let analystName = normalizeAnalystName(fallbackAnalystName);
  if (!analystName || analystName === 'BNN Analyst') {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const match = titleMatch[1].match(/^([^'’]+)(?:'s|’s)\s+(?:Top|Past)\s+Picks/i);
      if (match && match[1]) {
        analystName = normalizeAnalystName(match[1]);
      }
    }
  }

  if (!analystName) analystName = 'BNN Analyst';

  /* Locate "PAST PICKS:" block in text */
  const pastPicksRegex = /PAST\s+PICKS:\s*([A-Z]{3,4}\.?\s*\d{1,2},?\s*\d{4}|\d{4}-\d{2}-\d{2})([\s\S]*?)(?:DISCLOSURE|DISCLAIMER|MARKET\s+OUTLOOK|TOP\s+PICKS:|$)/i;
  const match = pastPicksRegex.exec(articleText);

  if (!match) {
    return [];
  }

  const rawReviewDate = match[1].trim();
  const pickPublishDate = parseDateToIso(rawReviewDate);
  const picksBlock = match[2];

  /* Regex to parse individual ticker blocks inside PAST PICKS:
     Example text:
     "iShares US Aerospace & Defense ETF (ITA CBOE) Then: US$218.90 Now: US$239.56 Return: 9% Total Return: 10%"
     or "Keyera (KEY TSX) Then: $32.10 Now: $38.40 Return: 19.6% Total Return: 24.2%"
  */
  const itemRegex = /([A-Za-z0-9\s&\.\-\'\(\)]+?)\((?:([A-Z0-9\.]+)\s+([A-Z]+)|([A-Z0-9\.]+))\)\s*Then:\s*(?:US\$|CAD\$|\$)?([\d\.]+)\s*Now:\s*(?:US\$|CAD\$|\$)?([\d\.]+)\s*Return:\s*(-?[\d\.]+)%\s*Total\s+Return:\s*(-?[\d\.]+)%/gi;

  const rows = [];
  let itemMatch;

  while ((itemMatch = itemRegex.exec(picksBlock)) !== null) {
    const rawCompany = itemMatch[1].trim();
    const rawTicker = (itemMatch[2] || itemMatch[4] || '').trim();
    const thenPrice = parseFloat(itemMatch[5]);
    const nowPrice = parseFloat(itemMatch[6]);
    const returnPct = parseFloat(itemMatch[7]);
    const totalReturnPct = parseFloat(itemMatch[8]);

    if (rawTicker && !isNaN(thenPrice) && !isNaN(nowPrice)) {
      /* Format Canadian tickers with .TO if exchange is TSX and no suffix present */
      let cleanTicker = rawTicker.toUpperCase();
      const exchange = (itemMatch[3] || '').toUpperCase();
      if ((exchange === 'TSX' || exchange === 'TOR') && !cleanTicker.includes('.')) {
        cleanTicker = `${cleanTicker}.TO`;
      }

      rows.push({
        analyst_name: analystName,
        source_article_url: sourceUrl,
        pick_publish_date: pickPublishDate,
        ticker: cleanTicker,
        company_name: rawCompany,
        then_price: thenPrice,
        now_price: nowPrice,
        return_pct: isNaN(returnPct) ? 0 : returnPct,
        total_return_pct: isNaN(totalReturnPct) ? (isNaN(returnPct) ? 0 : returnPct) : totalReturnPct,
        scraped_at: new Date().toISOString(),
      });
    }
  }

  return rows;
}
