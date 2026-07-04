export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', picks: [] });
  }

  try {
    const response = await fetch('https://www.bnnbloomberg.ca/investing/hot-picks/', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.status(200).json({ error: 'BNN unavailable', picks: [] });
    }

    const html = await response.text();
    const picks = [];

    /* Regex to extract article links and headlines from BNN Bloomberg hot picks page */
    const articleRegex = /<a[^>]+href=["'](\/investing\/hot-picks\/[^"']+|https:\/\/www\.bnnbloomberg\.ca\/investing\/hot-picks\/[^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match;
    const seenUrls = new Set();

    while ((match = articleRegex.exec(html)) !== null) {
      let url = match[1];
      if (url.startsWith('/')) {
        url = `https://www.bnnbloomberg.ca${url}`;
      }
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const rawContent = match[2].replace(/<[^>]+>/g, '').trim();
      if (rawContent.length < 10) continue;

      /* Attempt to parse guest name and firm from headline or content */
      let guest = 'BNN Analyst';
      let firm = 'MarketCall Commentator';
      
      const guestMatch = rawContent.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)+)(?:'s|’s|,|-|–|—|\s+on|\s+top|\s+hot)/i);
      if (guestMatch && guestMatch[1]) {
        guest = guestMatch[1].trim();
      } else {
        const byMatch = rawContent.match(/by\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i);
        if (byMatch && byMatch[1]) {
          guest = byMatch[1].trim();
        }
      }

      const firmMatch = rawContent.match(/,\s*([A-Z][a-zA-Z\s&,-]+(?:Securities|Capital|Asset|Management|Investments|Financial|Partners|Group|Advisors|Wealth))/i);
      if (firmMatch && firmMatch[1]) {
        firm = firmMatch[1].trim();
      }

      /* Extract potential tickers mentioned in parentheses e.g. (SHOP.TO) or capital letters */
      const tickerSet = new Set();
      const parenTickers = html.slice(Math.max(0, match.index - 500), match.index + 1500).match(/\(([A-Z]{1,5})(?:\.(?:TO|TSX|V|CN))?\)/gi);
      if (parenTickers) {
        for (const pt of parenTickers) {
          const clean = pt.replace(/[\(\)]/g, '').replace(/\.(TO|TSX|V|CN)$/i, '').trim();
          if (clean && clean.length >= 1 && clean !== 'TSX' && clean !== 'NYSE' && clean !== 'BNN') {
            tickerSet.add(clean);
          }
        }
      }

      /* Also look for common Canadian/US tickers if explicit parens weren't found */
      if (tickerSet.size === 0) {
        const words = rawContent.split(/\s+/);
        for (const w of words) {
          const cleanW = w.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, '').replace(/\.(TO|TSX|V|CN)$/i, '').trim();
          if (/^[A-Z]{2,5}$/.test(cleanW) && !['THE', 'FOR', 'AND', 'WITH', 'FROM', 'TOP', 'HOT', 'BUY', 'SELL', 'HOLD', 'BNN', 'TSX', 'CAD', 'USD'].includes(cleanW)) {
            tickerSet.add(cleanW);
          }
        }
      }

      if (tickerSet.size > 0 || guest !== 'BNN Analyst') {
        const dateStr = new Date().toISOString().split('T')[0];
        picks.push({
          guest,
          firm,
          date: dateStr,
          tickers: Array.from(tickerSet),
          headline: rawContent,
          url,
        });
      }
    }

    /* If no picks parsed, return error as requested by spec */
    if (picks.length === 0) {
      return res.status(200).json({ error: 'BNN unavailable', picks: [] });
    }

    return res.status(200).json(picks.slice(0, 15));
  } catch (error) {
    return res.status(200).json({ error: 'BNN unavailable', picks: [] });
  }
}
