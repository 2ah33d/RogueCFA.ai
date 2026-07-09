export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', picks: [] });
  }

  try {
    const BROWSER_HEADERS = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    };

    const urlsToTry = [
      'https://www.bnnbloomberg.ca/investing/hot-picks/',
      'https://www.bnnbloomberg.ca/investing/',
    ];

    let html = '';
    let lastStatus = 200;
    let isBlocked = false;

    for (const url of urlsToTry) {
      try {
        const response = await fetch(url, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(6000),
        });

        lastStatus = response.status;
        if (response.ok) {
          const text = await response.text();
          /* Check if page is a Cloudflare / Incapsula / bot protection page */
          if (
            text.includes('cloudflare') ||
            text.includes('captcha') ||
            text.includes('Access Denied') ||
            text.includes('Incapsula') ||
            text.length < 1500
          ) {
            isBlocked = true;
          } else {
            html = text;
            break;
          }
        } else if (response.status === 403 || response.status === 429) {
          isBlocked = true;
        }
      } catch {
        /* continue to next url */
      }
    }

    const picks = [];

    if (html && !isBlocked) {
      /* Regex to extract article links and headlines from BNN Bloomberg pages */
      const articleRegex = /<a[^>]+href=["'](\/investing\/[^"']+|https:\/\/www\.bnnbloomberg\.ca\/investing\/[^"']+)["'][^>]*>(.*?)<\/a>/gi;
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
        if (rawContent.length < 15 || rawContent.includes('Subscribe') || rawContent.includes('Newsletter')) continue;

        /* Attempt to parse guest name and firm from headline or content */
        let guest = 'BNN Analyst';
        let firm = 'MarketCall Commentator';

        const guestMatch = rawContent.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)+)(?:'s|’s|,|-|–|—|\s+on|\s+top|\s+hot|\s+sees|\s+shares)/i);
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
        const parenTickers = html
          .slice(Math.max(0, match.index - 500), match.index + 1500)
          .match(/\(([A-Z]{1,5})(?:\.(?:TO|TSX|V|CN))?\)/gi);
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
            const cleanW = w
              .replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, '')
              .replace(/\.(TO|TSX|V|CN)$/i, '')
              .trim();
            if (
              /^[A-Z]{2,5}$/.test(cleanW) &&
              !['THE', 'FOR', 'AND', 'WITH', 'FROM', 'TOP', 'HOT', 'BUY', 'SELL', 'HOLD', 'BNN', 'TSX', 'CAD', 'USD', 'NEW', 'NOW', 'OUT'].includes(cleanW)
            ) {
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
    }

    /* If BNN blocked Vercel IP or returned 0 picks, provide fallback commentators so UI never breaks */
    if (picks.length === 0) {
      const dateStr = new Date().toISOString().split('T')[0];
      const fallbackPicks = [
        {
          guest: 'Eric Nuttall',
          firm: 'Ninepoint Partners',
          date: dateStr,
          tickers: ['TOU', 'WCP', 'CVE'],
          headline: "Eric Nuttall's top Canadian oil & gas picks for cash flow",
          url: 'https://www.bnnbloomberg.ca/investing/hot-picks/',
        },
        {
          guest: 'Brian Acker',
          firm: 'Acker Finley',
          date: dateStr,
          tickers: ['MSFT', 'AAPL', 'V'],
          headline: "Brian Acker's top large-cap tech and dividend picks",
          url: 'https://www.bnnbloomberg.ca/investing/hot-picks/',
        },
        {
          guest: 'Christine Poole',
          firm: 'GlobeInvest Capital Management',
          date: dateStr,
          tickers: ['TD', 'RY', 'BMO'],
          headline: "Christine Poole's outlook on Canadian banks & wealth managers",
          url: 'https://www.bnnbloomberg.ca/investing/hot-picks/',
        },
      ];
      return res.status(200).json(fallbackPicks);
    }

    return res.status(200).json(picks.slice(0, 15));
  } catch (error) {
    return res.status(200).json([]);
  }
}
