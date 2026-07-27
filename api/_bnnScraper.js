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

  /* Query with guest name */
  const query = `${cleanName} past picks`;
  const searchUrl = `https://api.queryly.com/json.aspx?queryly_key=${QUERYLY_KEY}&query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[bnnScraper] Queryly returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items = data.items || [];
    const matched = [];
    const seenUrls = new Set();

    /* Scan up to 15 search results to ensure we collect 'limit' written articles */
    for (const item of items) {
      if (!item || !item.link) continue;
      let fullUrl = item.link.startsWith('/') ? `https://www.bnnbloomberg.ca${item.link}` : item.link;

      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      /* Ignore video player links (/video/shows/...) which contain no body text */
      if (fullUrl.includes('/video/shows/')) continue;

      const title = item.title || '';
      /* Match articles titled Top Picks, Past Picks, or guest name articles */
      if (/past\s+picks|top\s+picks/i.test(title) || /past\s+picks|top\s+picks/i.test(fullUrl) || title.toLowerCase().includes(cleanName.toLowerCase())) {
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

  /* Extract article body text and strip HTML tags */
  const articleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

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

  /* Attempt to locate pick review date in text (supports full month names like April, September, or abbreviations) */
  let pickPublishDate = new Date().toISOString().split('T')[0];
  const dateMatch = /(?:PAST|TOP)\s+PICKS:?\s*([A-Za-z]+\.?\s*\d{1,2},?\s*\d{4}|\d{4}-\d{2}-\d{2})/i.exec(articleText);
  if (dateMatch && dateMatch[1]) {
    pickPublishDate = parseDateToIso(dateMatch[1]);
  } else {
    /* Fallback: parse date from article URL if formatted as /YYYY/MM/DD/ */
    const urlDateMatch = /\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(sourceUrl);
    if (urlDateMatch) {
      pickPublishDate = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;
    }
  }

  /* Robust Regex to parse individual ticker blocks:
     Handles optional currency, hyphens (GRT-U), double dollar typos ($$68.27), optional Total Return line:
     "Exchange Income Corp (EIF TSX) Then: $76.75 Now: $125.84 Return: 64% Total Return: 67%"
     "AtkinsRéalis (ATRL TSX) Then: $$68.27 Now: $102.02 Return: 48%"
  */
  const itemRegex = /([A-Za-z0-9\s&\.\-\'\(\)éàèùâêîôûç]+?)\((?:([A-Z0-9\.\-]+)\s+([A-Za-z0-9]+)|([A-Z0-9\.\-]+))\)\s*Then:\s*(?:US\$|CAD\$|\$+)?([\d\.]+)\s*Now:\s*(?:US\$|CAD\$|\$+)?([\d\.]+)\s*Return:\s*(-?[\d\.]+)%(?:\s*Total\s+Return:\s*(-?[\d\.]+)%)?/gi;

  const rows = [];
  const seenTickersInArticle = new Set();
  let itemMatch;

  while ((itemMatch = itemRegex.exec(articleText)) !== null) {
    let rawCompany = itemMatch[1]
      .replace(/.*?(PAST|TOP)\s+PICKS:?\s*([A-Za-z]+\.?\s*\d+,?\s*\d+)?/i, '')
      .replace(/^.*?\.\s*/, '')
      .replace(/^[0-9\s]+/, '')
      .trim();

    const rawTicker = (itemMatch[2] || itemMatch[4] || '').trim();
    const thenPrice = parseFloat(itemMatch[5]);
    const nowPrice = parseFloat(itemMatch[6]);
    const returnPct = parseFloat(itemMatch[7]);
    const totalReturnPct = itemMatch[8] ? parseFloat(itemMatch[8]) : returnPct;

    if (rawTicker && !isNaN(thenPrice) && !isNaN(nowPrice)) {
      /* Format Canadian tickers with .TO or .V if exchange is TSX/Venture */
      let cleanTicker = rawTicker.toUpperCase();
      const exchange = (itemMatch[3] || '').toUpperCase();
      if ((exchange.includes('TSX') || exchange.includes('TOR')) && !cleanTicker.includes('.')) {
        cleanTicker = `${cleanTicker}.TO`;
      } else if ((exchange.includes('VENTURE') || exchange === 'V' || exchange === 'TSXV') && !cleanTicker.includes('.')) {
        cleanTicker = `${cleanTicker}.V`;
      }

      /* Deduplicate repeat matches within the same article body */
      if (seenTickersInArticle.has(cleanTicker)) continue;
      seenTickersInArticle.add(cleanTicker);

      rows.push({
        analyst_name: analystName,
        source_article_url: sourceUrl,
        pick_publish_date: pickPublishDate,
        ticker: cleanTicker,
        company_name: rawCompany || rawTicker,
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
