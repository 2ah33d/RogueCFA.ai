# PRD: RogueCFA.ai — AI Investment Scorecard

> **Version:** 1.0  
> **Author:** Zaheed Bhai  
> **Last Updated:** 2026-07-01  
> **Status:** Ready for Development

---

## 1. Product Overview

**RogueCFA.ai** is a React web application that lets retail investors score any stock ticker against their intended hold period using live Finnhub data and their own LLM API key (BYOK — Bring Your Own Key).

A thin Vercel serverless proxy handles all API calls server-side, solving CORS restrictions and keeping user keys out of the browser's network layer. The app produces a consistent, structured investment scorecard in under 60 seconds.

**One-liner:** *Paste a ticker, pick a time horizon, get an AI-scored investment card — powered by your own keys, free forever.*

---

## 2. Target User

| Attribute       | Detail                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persona**     | Retail investor, 35–65, who watches BNN Bloomberg MarketCall, CNBC, or similar financial TV as a deal-discovery channel.                                 |
| **Need**        | Data-backed verification of TV analyst picks without spending 45–90 minutes manually reading filings, consensus data, and news.                          |
| **Behavior**    | Comfortable pasting API keys from free-tier services. Expects results in seconds, not minutes. Will abandon any tool that requires account creation.     |
| **Non-target**  | Institutional traders, algorithmic quant desks, or users expecting real-time streaming data. These users need Bloomberg Terminal-class tools, not this.   |

---

## 3. Problem Statement

1. **No quick verification path.** TV analyst picks arrive with conviction but no easy way to cross-check the underlying data signal.
2. **Manual research is slow.** Reading filings, checking consensus, and scanning news takes 45–90 minutes per ticker — prohibitive when 5 picks land in a single segment.
3. **Time-horizon blindness.** No free tool applies time-horizon logic. A 1-month momentum trade and a 3-year structural hold require fundamentally different evaluation criteria, yet every screener treats them identically.

---

## 4. Core Features

| #  | Feature                    | Description                                                                              | Priority | Notes                                            |
| -- | -------------------------- | ---------------------------------------------------------------------------------------- | -------- | ------------------------------------------------ |
| 1  | **BYOK Key Manager**       | User pastes Finnhub + LLM API keys; stored in `localStorage` only, never in any database | P0       | "Clear Keys" button in settings panel            |
| 2  | **Ticker Input**           | Single or multi-ticker text input (comma-separated, max 5)                               | P0       | Validate ticker against Finnhub `/stock/profile2` before scoring |
| 3  | **Hold Period Selector**   | Dropdown: `1M` / `3M` / `6M` / `1Y` / `3Y`                                             | P0       | Drives prompt weighting logic (§7)               |
| 4  | **Data Fetch Layer**       | Pull analyst consensus, news, profile, and quote from Finnhub on submit                  | P0       | All calls routed through Vercel proxy            |
| 5  | **LLM Scoring Engine**     | Inject Finnhub data into time-weighted prompt → parse structured JSON response           | P0       | Supports Gemini, Claude, OpenAI (§7)             |
| 6  | **Scorecard Display**      | Render LLM JSON response as a styled scorecard card per ticker                           | P0       | Visual spec in §8                                |
| 7  | **LLM Provider Selector**  | Dropdown: Gemini / Claude / OpenAI — swaps endpoint, auth, and payload format            | P1       | Default: Gemini (free tier, easiest onboarding)  |
| 8  | **Multi-Ticker Comparison**| Side-by-side scorecard view for 2–5 tickers                                              | P1       | Responsive grid; stacks vertically on mobile     |
| 9  | **Score History**          | `localStorage` log of past scored tickers with timestamp                                 | P2       | No database; "Clear History" button              |
| 10 | **Disclaimer Banner**      | Persistent "Not financial advice" notice on every page                                   | P0       | Legal hygiene — always visible, never dismissable |

---

## 5. User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User opens app                                              │
│     └─> If no keys in localStorage → show Key Setup modal       │
│  2. User enters Finnhub key + LLM key → saved to localStorage   │
│  3. User selects LLM provider from dropdown                     │
│  4. User types ticker(s) into input field                       │
│  5. User selects hold period from dropdown                      │
│  6. User clicks "Score It"                                      │
│     └─> [Loading state with progress indicator]                 │
│  7. App → Vercel proxy → Finnhub (consensus + news + profile    │
│     + quote) → returns data to app                              │
│  8. App constructs time-weighted prompt with fetched data        │
│  9. App → Vercel proxy → LLM API → returns scored JSON          │
│ 10. App parses JSON → renders scorecard card(s)                 │
│ 11. Score logged to localStorage history                        │
└─────────────────────────────────────────────────────────────────┘
```

### Error States

| Condition                        | Behavior                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| Invalid API key (401/403)        | Toast: "Your [Provider] key was rejected. Please check it in Settings."  |
| Ticker not found on Finnhub      | Inline error under input: "Ticker not recognized. Try the exchange-qualified symbol (e.g., `SHOP` for NYSE, `SHOP.TO` for TSX)." |
| Finnhub rate limit (429)         | Toast: "Finnhub rate limit hit. Wait 60 seconds and retry."             |
| LLM returns malformed JSON       | Retry once automatically. On second failure: "AI returned an unparseable response. Try again or switch providers." |
| Sparse Finnhub data (< 3 analysts) | Show scorecard with ⚠️ "Limited Data" badge. Score still generated, but disclaimer: "Fewer than 3 analyst ratings available — score reliability is reduced." |
| Network failure                  | Toast: "Network error. Check your connection and retry."                |

---

## 6. Data Layer

| Data Source                         | Finnhub Endpoint              | What It Provides                           | Free Tier Limit  |
| ----------------------------------- | ----------------------------- | ------------------------------------------ | ---------------- |
| Analyst Consensus                   | `GET /stock/recommendation`   | Buy / Hold / Sell / Strong Buy / Strong Sell counts | 60 calls/min |
| Company News                        | `GET /company-news`           | Last 30 days of news headlines + summaries | 60 calls/min     |
| Company Profile                     | `GET /stock/profile2`         | Company name, sector, market cap, exchange | 60 calls/min     |
| Stock Quote                         | `GET /quote`                  | Current price, % change, 52-week high/low  | 60 calls/min     |
| LLM Analysis                        | `POST` to user's LLM provider| Scored analysis JSON (schema in §7)        | User's own quota |

### Proxy Architecture

All external API calls route through Vercel Serverless Functions:

```
Browser → POST /api/score → Vercel Function → Finnhub APIs + LLM API → Response → Browser
```

- **Keys are sent in the POST request body** (HTTPS encrypted in transit).
- **The proxy never logs, stores, or caches any API key.** Keys are used for that single invocation only.
- **CORS headers** are set by the Vercel function, not the browser.

---

## 7. LLM Integration Spec

### 7.1 BYOK Key Management

| Key                      | `localStorage` Key         | Purpose                   |
| ------------------------ | -------------------------- | ------------------------- |
| Finnhub API Key          | `roguecfa_finnhub_key`     | Finnhub data fetching     |
| LLM API Key              | `roguecfa_llm_key`         | LLM scoring calls         |
| LLM Provider Selection   | `roguecfa_llm_provider`    | `gemini` / `claude` / `openai` |

- Keys are **read from `localStorage` at request time** and sent in the POST body to the Vercel proxy.
- The proxy uses the key for that single call only — **never logged, never stored, never cached**.
- Settings panel includes a **"Clear All Keys"** button that wipes all three `localStorage` entries.
- No key ever persists outside the user's own browser.

### 7.2 Supported Providers

| Provider | API Endpoint                                                                                             | Auth Mechanism                          | Default Model         |
| -------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------- |
| Gemini   | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={KEY}`     | API key as query parameter              | `gemini-2.0-flash`    |
| Claude   | `https://api.anthropic.com/v1/messages`                                                                  | `x-api-key` header + `anthropic-version`| `claude-sonnet-4-6`  |
| OpenAI   | `https://api.openai.com/v1/chat/completions`                                                             | `Authorization: Bearer {KEY}`           | `gpt-4o-mini`         |

### 7.3 Time-Horizon Prompt Weighting

The system prompt dynamically adjusts evaluation weights based on the user's selected hold period:

| Factor                          | Short Term (1M–3M) | Mid Term (6M) | Long Term (1Y–3Y) |
| ------------------------------- | ------------------- | -------------- | ------------------- |
| Recent news sentiment           | 40%                 | 27.5%          | 15%                 |
| Analyst consensus direction     | 35%                 | 27.5%          | 20%                 |
| Price momentum / 52w position   | 15%                 | 15%            | 15% (macro/sector)  |
| Company guidance / structural   | 10%                 | 30%            | 50% (durability)    |

**Short Term (1M–3M) — Prompt Instruction:**
> "Weight recent news sentiment and analyst consensus direction-of-change most heavily. Flag any catalysts or risks materializing within 90 days. Price momentum and 52-week positioning are relevant. Discount long-term structural factors."

**Mid Term (6M) — Prompt Instruction:**
> "Balance short-term catalysts with structural positioning. Give equal consideration to news momentum and business model durability. Flag risks in both the 0–90 day and 90–180 day windows."

**Long Term (1Y–3Y) — Prompt Instruction:**
> "Ignore short-term price action and news noise. Focus on whether the business model has structural durability, management guidance quality, and sector tailwinds. Analyst consensus stability matters more than direction-of-change."

### 7.4 Required LLM Output Schema

The system prompt must enforce this exact JSON response schema:

```json
{
  "ticker": "AAPL",
  "score": 74,
  "grade": "B",
  "analyst_consensus": {
    "buy": 14,
    "hold": 3,
    "sell": 1,
    "total": 18,
    "label": "14 of 18 analysts recommend BUY"
  },
  "sentiment_summary": "One sentence on recent news tone and key themes.",
  "timeframe_verdict": "One sentence specific to the user's selected hold period.",
  "key_risks": ["risk one", "risk two"],
  "key_catalysts": ["catalyst one", "catalyst two"],
  "signal": "BUY_SIGNAL"
}
```

**`signal` values:** `BUY_SIGNAL` | `WATCH` | `AVOID`

**System prompt must include:**
> "You are a CFA-level equity analyst. Respond only with valid JSON matching this exact schema. No preamble, no markdown fences, no explanation outside the JSON object. The `score` field must be an integer from 0 to 100. The `grade` field must be one of: A, B, C, D, F. The `signal` field must be one of: BUY_SIGNAL, WATCH, AVOID."

### 7.5 Score Rubric

The LLM is instructed to derive the 0–100 score using this fixed rubric (embedded in the system prompt):

| Component                | Weight | Scoring Guidance                                                                                    |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| Analyst Consensus Signal | 35 pts | Strong Buy consensus → 30–35. Mixed → 15–25. Strong Sell → 0–10.                                   |
| News Sentiment           | 25 pts | Overwhelmingly positive → 20–25. Neutral → 10–15. Negative → 0–10.                                |
| Price Momentum           | 20 pts | Near 52w high with volume → 15–20. Mid-range → 8–12. Near 52w low on weak volume → 0–5.            |
| LLM Qualitative Judgment | 20 pts | Holistic assessment of data coherence, risk/catalyst balance, and time-horizon fit.                  |

**Grade mapping:**

| Score Range | Grade |
| ----------- | ----- |
| 90–100      | A     |
| 75–89       | B     |
| 60–74       | C     |
| 40–59       | D     |
| 0–39        | F     |

**Signal mapping:**

| Score Range | Signal       | Badge Color |
| ----------- | ------------ | ----------- |
| 70–100      | `BUY_SIGNAL` | Green       |
| 45–69       | `WATCH`      | Yellow      |
| 0–44        | `AVOID`      | Red         |

---

## 8. Scorecard Output Spec

Each scored ticker renders as a card with the following fields:

| Field                | Example Value                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Ticker**           | SHOP                                                                                                     |
| **Company Name**     | Shopify Inc.                                                                                             |
| **AI CFA Score**     | 74 / 100                                                                                                 |
| **Grade**            | C                                                                                                        |
| **Signal Badge**     | `[BUY_SIGNAL]` (green) · `[WATCH]` (yellow) · `[AVOID]` (red)                                           |
| **Hold Period**      | 6 Months                                                                                                 |
| **Analyst Consensus**| 14 of 18 analysts recommend BUY                                                                         |
| **Sentiment Summary**| News broadly positive; one risk flagged around margin compression heading into Q4.                       |
| **Timeframe Verdict**| High conviction for 6-month hold; elevated volatility expected in first 30 days pre-earnings.            |
| **Key Risks**        | • Margin compression • CAD/USD exposure                                                                  |
| **Key Catalysts**    | • Analyst upgrade momentum • New enterprise product cycle                                                |
| **Scored At**        | 2026-07-01 3:15 PM ET                                                                                   |
| **Disclaimer**       | *This is not financial advice. AI-generated analysis may contain errors. Verify independently before acting.* |

### Multi-Ticker Layout

- **2 tickers:** Two-column grid
- **3–5 tickers:** Responsive grid, 2–3 columns on desktop, single column on mobile
- Each card is independently scrollable if content overflows

---

## 9. Tech Stack

| Layer            | Technology                          | Rationale                                              |
| ---------------- | ----------------------------------- | ------------------------------------------------------ |
| **Framework**    | React (Vite)                        | Fast dev server, zero-config, no backend needed        |
| **Styling**      | Tailwind CSS                        | Rapid UI iteration, utility-first, no custom design system overhead |
| **State**        | `localStorage`                      | Zero-database key and history persistence              |
| **Proxy**        | Vercel Serverless Functions (Node)  | Free proxy layer, CORS solved, same deployment unit    |
| **Data**         | Finnhub REST API                    | Free tier, reliable, covers analyst consensus + news   |
| **HTTP**         | Native `fetch()`                    | No HTTP library dependency needed                      |
| **Hosting**      | Vercel (Hobby tier)                 | Free hosting, frontend + serverless functions unified   |
| **Database**     | None                                | Explicit scope constraint — no persistent server state |

---

## 10. Security & Privacy

| Concern                   | Mitigation                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Key exposure in browser   | Keys never appear in URL params or GET requests from the browser. All calls are POST to Vercel proxy.   |
| Key exposure in proxy     | Proxy reads key from request body, uses it for one call, discards. No logging of request bodies.        |
| Key exposure in transit   | All communication over HTTPS (Vercel enforces TLS).                                                     |
| Prompt injection          | Finnhub data is sanitized (HTML stripped, length-capped at 2000 chars for news) before prompt injection. |
| localStorage security     | Keys are scoped to the domain. "Clear All Keys" button available. User is warned not to use shared/public computers. |
| Rate limiting             | Proxy enforces max 10 requests per minute per IP via Vercel Edge Config (prevents abuse of free tier).  |

---

## 11. Non-Functional Requirements

| Requirement       | Target                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **Performance**   | End-to-end scorecard render in < 60 seconds from "Score It" click (single ticker)        |
| **Availability**  | 99.5% uptime (Vercel Hobby tier SLA baseline)                                           |
| **Responsiveness**| Fully functional on desktop (1024px+) and mobile (375px+)                                |
| **Accessibility** | Semantic HTML, sufficient color contrast (WCAG AA), keyboard-navigable                   |
| **Bundle Size**   | < 200KB gzipped initial load (no heavy charting libraries in v1)                         |
| **Browser Support** | Chrome, Firefox, Safari, Edge — latest 2 versions                                      |

---

## 12. Out of Scope (v1)

The following are explicitly excluded from the v1 build. Some may be considered for v2.

- Earnings call transcript fetching or parsing
- SEDAR+ / Canadian filing integration
- SEC EDGAR filing retrieval
- Real-time or live-streaming price data (WebSocket)
- User accounts, authentication, or cloud-stored history
- Portfolio tracking or position sizing
- Push notifications or watchlist alerts
- Native mobile app (responsive web only)
- Any LLM fine-tuning or model training
- Paid data sources (Bloomberg, FactSet, Refinitiv)
- Charting or technical analysis visualizations
- Social sharing or export-to-PDF

---

## 13. Milestones & Delivery Phases

| Phase | Scope                                                                                 | Deliverable                                  |
| ----- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| **1** | Project scaffolding, Vercel proxy, BYOK key manager, single-ticker scoring pipeline   | Working single-ticker score with Gemini      |
| **2** | All 3 LLM providers, hold-period weighting, scorecard UI polish                       | Provider switching, time-weighted prompts     |
| **3** | Multi-ticker comparison, score history, error handling, responsive mobile layout       | Feature-complete v1                          |
| **4** | Security audit, performance optimization, final QA, production deploy                 | Production-ready v1 on Vercel                |

---

## 14. Acceptance Criteria

> These criteria define "done" for v1 and should be verified before final delivery.

1. **Single-ticker scoring:** User can enter one ticker, select a hold period, and receive a rendered scorecard in < 60 seconds.
2. **Multi-ticker scoring:** User can enter 2–5 comma-separated tickers and receive side-by-side scorecards.
3. **Provider switching:** User can switch between Gemini, Claude, and OpenAI and receive valid scorecards from each.
4. **Hold-period differentiation:** Scoring the same ticker at 1M and 3Y produces noticeably different `timeframe_verdict` and `score` values.
5. **Key security:** Browser DevTools Network tab shows no API keys in any request to any domain other than the Vercel proxy.
6. **Error resilience:** Invalid key, unknown ticker, rate limit, and network failure all produce user-friendly messages (no raw errors or blank screens).
7. **Data accuracy:** Analyst consensus counts in the scorecard match Finnhub's own website for the same ticker on the same day (spot-checked across 10 tickers).
8. **Sparse data handling:** A ticker with < 3 analyst ratings displays a "Limited Data" warning badge and still generates a score.
9. **Mobile responsive:** All screens are usable at 375px width without horizontal scrolling.
10. **Disclaimer visibility:** "Not financial advice" disclaimer is visible on every page state, including loading and error states.

---

## 15. Design Decisions (Resolved)

These items were originally open questions. Decisions are documented here for the contractor's reference.

### 15.1 Gemini Server-Side Calls

**Decision:** Gemini's `generateContent` endpoint accepts server-side calls from Vercel with the API key as a query parameter. This has been validated. The Vercel proxy constructs the full URL with the key appended and makes the call server-side — the key never touches the browser.

### 15.2 Finnhub Coverage for TSX-Only Stocks

**Decision:** Score anyway with a warning. If Finnhub returns fewer than 3 analyst ratings for a ticker, the app will:
- Still generate a score using whatever data is available
- Display a ⚠️ **"Limited Data"** badge on the scorecard
- Include a disclaimer: *"Fewer than 3 analyst ratings available — score reliability is reduced."*

Rationale: Blocking scoring entirely creates a dead-end UX. A degraded-but-honest result is more useful than no result.

### 15.3 Score Rubric Weights

**Decision:** The score rubric is defined in §7.5 and is hardcoded into the system prompt. Weights are:
- Analyst Consensus Signal: **35 pts**
- News Sentiment: **25 pts**
- Price Momentum: **20 pts**
- LLM Qualitative Judgment: **20 pts**

These weights are embedded in the prompt, not calculated client-side. The LLM is instructed to apply them consistently. This makes scores comparable across tickers while still allowing the LLM's qualitative judgment to differentiate nuanced cases.

---

## 16. Glossary

| Term            | Definition                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **BYOK**        | Bring Your Own Key — user provides their own API keys; the app never provisions or stores them.         |
| **Scorecard**   | The rendered output card showing the AI-generated investment analysis for a single ticker.               |
| **Hold Period** | The user's intended investment time horizon, used to adjust scoring weights.                             |
| **Signal**      | The top-level recommendation: `BUY_SIGNAL`, `WATCH`, or `AVOID`.                                       |
| **Proxy**       | The Vercel serverless function that sits between the browser and external APIs, handling auth and CORS.  |

## 17. Scoring Philosophy
**Status:** Implemented in V2, framing revised

**Core decision:**
The deterministic calculateScore.js produces a 0-100 number from hard data. This number is NOT a buy/sell prediction. It is a confidence indicator — how much data exists and how consistently it points in one direction. Claude's reasoning layer is the actual analysis. The score is the transparency layer.

**Why fixed-weight formulas are insufficient as primary signals:**
- Any formula with fixed weights breaks under unanticipated conditions
- 1 analyst recommending Buy out of 10 scores identically to 1 out of 10 in a naive formula — but these are completely different signals
- Strong earnings + weak analyst consensus is a contradiction that requires interpretation, not arithmetic
- Sector conditions, macro environment, and coverage depth cannot be captured in static multipliers

**What the math score should represent:**
- High score = strong data quality + high signal consistency
- Low score = weak data, conflicting signals, or low analyst coverage
- NOT a prediction of price direction

**Coverage depth modifier (required):**
Analyst consensus weight must scale with total analyst coverage:
- 1-3 analysts: weight consensus at 20% of normal
- 4-10 analysts: weight consensus at 60% of normal  
- 11-20 analysts: weight consensus at 80% of normal
- 20+ analysts: full consensus weight
Flag low coverage explicitly in the scorecard UI.

**Signal conflict detection (required):**
Before Claude writes narrative, the prompt must explicitly flag contradictions in the data:
- Strong earnings + weak analyst consensus → flag and explain
- High buy consensus + stock at 52W low → flag and explain
- Analyst upgrades + insider selling → flag and explain
Claude must address the conflict directly before writing the thesis.
If no conflict: proceed normally.

**Claude's role in scoring:**
Claude receives the pre-calculated score + all raw data + any detected conflicts. Claude does not modify the score. Claude explains:
1. Which signals were weighted most for this hold period and why
2. What the conflict means if one was detected
3. What to watch for that could change the thesis

**What Claude must never do:**
- Reference data not explicitly provided in the prompt
- Describe price ranges as "narrow" or "wide" without exact numbers
- Invent analyst sentiment beyond what the count data shows
- Produce or modify the numerical score

OPEN QUESTION: At what point does low data availability warrant blocking the scorecard entirely vs showing a low-confidence result?

---

## 18. Roadmap Features

### Score History + Outcome Tracking
**Priority:** P1  
**Status:** Implemented in V2

**What it does**
Logs every generated scorecard to browser storage alongside its historical entry price and date. Evaluates past scorecards against current market prices to display percentage return and accuracy against the original buy/avoid signal.

**User flow**
1. User clicks the History tab in the main navigation.
2. App renders a chronological table of all saved scorecards with entry date, ticker, original score, and original entry price.
3. User clicks "Update Outcomes" button.
4. App fetches current price for each historical ticker and renders percentage gain/loss alongside outcome verification status.

**Data requirements**
- Finnhub (`GET /quote`): Provides current real-time stock price to calculate historical return (Free tier: 60 calls/min).
- `localStorage` (`roguecfa_history`): Provides stored scorecard object, timestamp, original price (`quote.c`), and original signal (`BUY_SIGNAL`, `WATCH`, `AVOID`).

**Technical notes**
- Modify `src/lib/storage.js` to store original `quote.c` entry price and historical timestamp inside `addToHistory`.
- Create `src/components/HistoryTable.jsx` to render stored scorecards, calculate return percentage, and display hit/miss outcome tags.
- Modify `src/App.jsx` to add navigation view toggle between Score Form and History Table views.

**Out of scope for v1 of this feature**
- Automated background price fetching or daily portfolio tracking.
- Cloud storage or cross-device history synchronization.
- Benchmark comparison against S&P 500 or TSX Composite indices.

**Success metric**
History table accurately calculates and displays entry-to-current percentage return for 100% of stored scorecards when manually refreshed.

---

### Head-to-Head Ticker Comparison
**Priority:** P1  
**Status:** Implemented in V2

**What it does**
Compares two to five stock tickers side-by-side across deterministic math sub-scores and valuation metrics for a shared hold period. Highlights the top-scoring ticker and provides a comparative LLM narrative summarizing relative risks and trade-offs.

**User flow**
1. User enters multiple comma-separated tickers in the input box and selects a shared hold period.
2. App fetches market data and executes `calculateScore` independently for each ticker.
3. App sends unified comparison payload to LLM proxy requesting comparative analysis across all inputs.
4. App renders a comparative matrix table above individual cards highlighting the highest-ranking ticker.

**Data requirements**
- Finnhub (`GET /stock/profile2`, `GET /quote`, `GET /stock/recommendation`): Provides price, consensus, and profile data for each ticker (Free tier).
- Alpha Vantage (`OVERVIEW`, `EARNINGS`): Provides P/E, EPS growth, and valuation ratios per ticker (Free tier: 5 calls/min).
- LLM Provider (Gemini / Claude / OpenAI): Produces structured JSON comparative summary and relative winner selection (User API quota).

**Technical notes**
- Modify `src/lib/promptBuilder.js` to add a `buildComparisonPrompt` function accepting multiple pre-calculated score objects and raw fundamentals.
- Create `src/components/ComparisonMatrix.jsx` to render side-by-side data columns highlighting winning sub-scores using utility CSS classes.
- Modify `src/App.jsx` to detect multi-ticker submissions and trigger the unified comparison prompt alongside individual card rendering.

**Out of scope for v1 of this feature**
- Cross-industry normalization or sector-specific custom weighting models.
- Exporting comparison table to CSV, PDF, or spreadsheet formats.
- Comparing tickers across different hold periods simultaneously.

**Success metric**
Submitting two to five valid tickers renders a side-by-side comparison matrix identifying the highest-scoring stock in under 60 seconds.

---

### Canadian Market Identity (TSX-first)
**Priority:** P2  
**Status:** Implemented in V2

**What it does**
Automatically detects Canadian stock symbols and prioritizes Toronto Stock Exchange (`.TO`) ticker formatting, Canadian dollar currency display, and domestic benchmark framing. Resolves dual-listed equities by highlighting Canadian exchange liquidity and reporting currency.

**User flow**
1. User types a Canadian stock symbol or company name into the ticker input box.
2. App appends `.TO` extension if un-suffixed and validates against Canadian exchange listings.
3. App displays financial figures explicitly labeled in CAD and compares valuation metrics against Canadian sector norms.

**Data requirements**
- Finnhub (`GET /stock/profile2`): Provides country of headquarters, exchange listing (`TSX` or `TORONTO`), and reporting currency (`CAD`) (Free tier).
- Alpha Vantage (`OVERVIEW`): Provides fundamental metrics labeled with currency unit (`Currency: CAD`) (Free tier).

**Technical notes**
- Modify `src/components/ScoreForm.jsx` to append `.TO` suffix automatically when user toggles a "TSX Only" input filter checkbox.
- Modify `src/lib/promptBuilder.js` to inject explicit currency instructions into the system prompt requiring CAD formatting for TSX-listed tickers.
- Modify `src/components/Scorecard.jsx` to display a distinct red-and-white "TSX" badge and render price strings with CAD prefix.

**Out of scope for v1 of this feature**
- SEDAR+ regulatory filing retrieval or scraping.
- Currency conversion rates or real-time CAD/USD FX adjustments.
- Canadian tax optimization or dividend tax credit calculations.

**Success metric**
100% of valid TSX tickers entered without a suffix resolve correctly to their `.TO` profile and display all monetary metrics clearly designated in CAD.

---

### Watchlist + Re-score Alerts
**Priority:** P2  
**Status:** Planned

**What it does**
Allows users to save scored stocks to a persistent local watchlist categorized by intended hold horizon. Highlights score or rating shifts when the user manually re-scores stored watchlist items.

**User flow**
1. User clicks "Add to Watchlist" button on any rendered scorecard.
2. App stores ticker, current score, and hold horizon in local storage watchlist array.
3. User navigates to Watchlist tab and clicks "Re-score All".
4. App executes fresh scoring pipeline sequentially and displays point deltas (`+5` or `-8`) relative to previous score.

**Data requirements**
- `localStorage` (`roguecfa_watchlist`): Provides saved watchlist array containing tickers, baseline score, baseline grade, and horizon.
- Finnhub & Alpha Vantage APIs: Provides fresh market data and fundamentals during manual re-score batches (Free tiers).

**Technical notes**
- Modify `src/lib/storage.js` to add `roguecfa_watchlist` CRUD helpers (`getWatchlist`, `addToWatchlist`, `removeFromWatchlist`).
- Create `src/components/WatchlistPanel.jsx` to display saved items, execute sequential re-scoring to respect rate limits, and render score change badges.
- Modify `src/components/Scorecard.jsx` to add an action button for bookmarking current card directly into `roguecfa_watchlist`.

**Out of scope for v1 of this feature**
- Email, SMS, or browser push notifications when scores change.
- Automated scheduled background re-scoring while app is closed.
- Watchlists exceeding 10 tickers due to API rate constraints.

**Success metric**
Clicking "Re-score All" on a saved watchlist updates all stored scores and accurately computes numerical point deltas without triggering API rate limit errors.

---

### BNN MarketCall Guest Track Record & Automated TV Intelligence
**Priority:** P1  
**Status:** Architecture Specified / In Development

**What it does**
Tracks stock picks broadcast by guest analysts on BNN Bloomberg MarketCall across a curated roster of 20 recurring fund managers. Eliminates manual television watching by automatically discovering and extracting morning broadcast picks, logging them into persistent storage, and evaluating historical guest accuracy against live market prices.

#### MODULE: The Automated Data Pipeline (The $0.00 Stack)
**Objective:**
To automatically maintain a fresh, up-to-date database of BNN MarketCall analyst picks without triggering anti-bot firewalls, incurring scraping costs, or relying on manual data entry.

**Architecture & Workflow:**
1. **The Trigger (Vercel Cron):** A free Vercel Cron Job fires automatically every Friday at 5:00 PM EST after the market closes.
2. **The Sweeper (Tavily Search API):** The cron job triggers Tavily (free tier) to search the web specifically for *"BNN MarketCall Top Picks"* from the past 7 days, returning the clean text of the summary articles and bypassing BNN's IP blocks.
3. **The Extractor (Groq API + Llama 3.1):** The raw article text is sent to the Groq API (free tier). The Llama 3.1 70B model reads the text and extracts the analyst names, broadcast dates, and stock tickers into a structured JSON array.
4. **The Storage (Supabase):** The clean JSON is appended to a free Supabase Postgres database (or local JSON registry/storage in v1 hybrid mode).
5. **The Live Math Engine:** When a user searches for an analyst on the frontend, the app reads the historical picks from Supabase/storage, hits Finnhub/Yahoo Finance for the live stock price, and calculates the exact percentage return using standard Python/JS math (**0 tokens burned**).

**The 20-Guest Curated Roster:**
The system tracks the following recurring BNN MarketCall commentators:
Eric Nuttall, Brian Acker, Christine Poole, Jason Bouvier, John Connell, Bruce Murray (Murray Wealth Group), Chris White (5i Research), Andrey Omelchak (LionGuard Capital Management), Greg Newman (Newman Group, ScotiaMcLeod), Brendan Caldwell (Caldwell Investment Management), Paul Harris (Harris Douglas Asset Management), Ryan Bushell (Newhaven Asset Management), Rick Rule (Rule Investment Media), Ivana Delevska (SPEAR Invest), Michael Hakes (Murray Wealth Group), Kim Bolton (Black Swan Dexteritas), Bruce Campbell (Campbell, Lee & Ross), Darren Sissons (Campbell, Lee & Ross), Norm Levine (Portfolio Management Corp.), Larry Berman (ETF Capital Management).

**User flow**
1. User navigates to the "Trending Radar" / BNN Analyst Tracker view.
2. App loads the 20-guest roster and displays top trending stocks backed by ELITE analysts (accuracy hit rate $\ge 70\%$).
3. User clicks any analyst to open the **Analyst Verification Modal**, viewing their credibility tier, itemized historical pick table, starting price, live price, and percentage return.
4. User clicks "Score Pick" on any itemized row to run RogueCFA's deterministic math model and CFA scorecard analysis on that specific stock.

**Data requirements**
- **Vercel Cron + Tavily Search API (Free Tier):** Sweeps web articles for weekly MarketCall pick summaries without triggering site anti-bot blocking.
- **Groq API (`llama-3.1-70b-versatile` Free Tier):** Extracts structured JSON (`guestName`, `firm`, `topPicks`, `quotes`) from raw text at $0.00 cost.
- **Supabase Postgres / Hybrid Registry:** Stores historical pick ledgers (`ticker`, `pickPrice`, `date`, `guestId`).
- **Finnhub (`GET /quote` Free Tier):** Provides live current stock prices (`c`) to calculate real-time percentage returns and hit-rate accuracy.

**Technical notes**
- Enforce CFA Statistical Confidence Rule: An analyst must have at least 3 resolved picks (completed hold horizon) before computing an official Accuracy Hit Rate percentage.
- Implement Model Tiering: Never use flagship LLMs (Claude 3.5 Sonnet / GPT-4o) for automated transcript/article reading. Reserve flagship models strictly for user-initiated CFA scorecard generation.
- Enforce Analyst Credibility Weighting in `promptBuilder.js`: If a stock is recommended by an ELITE analyst ($\ge 70\%$ hit rate), instruct the LLM to highlight their track record as a qualitative catalyst; if $< 50\%$ hit rate, flag as a risk factor.

**Success metric**
The Automated Data Pipeline executes weekly via Vercel Cron without IP blocking or token costs ($0.00 operational expenditure), correctly storing extracted guest picks in Supabase and computing real-time commentator return accuracy across logged tickers with 0% calculation error.

---

### Tier 1: Daily MarketCall Digest
**Priority:** P1  
**Status:** Planned

**What it does**
Automatically fetches that day's BNN MarketCall episode transcript and produces a condensed, readable digest (500–1000 words) covering the guest's background, market outlook, and every stock pick with their full stated reasoning. Fully replaces the need to watch the episode.

**User flow**
1. User opens RogueCFA and navigates to the "Today's Picks" tab.
2. If today's digest hasn't been generated yet, app fetches it on-demand (or shows cached digest if already generated today).
3. App displays: guest name + firm, their stated market outlook/theme for the episode, and each pick with reasoning.
4. Each pick shown as an expandable card with a "Score This" button that pre-fills the ticker into the main scoring flow.
5. User reads the full digest in under 2 minutes instead of watching a 45-minute broadcast.

**Data requirements**
- **YouTube Data API (free tier, 10,000 units/day):** Fetches BNN Bloomberg's MarketCall video ID and auto-generated transcript for the current day's episode.
- **Claude API (Sonnet):** Condenses raw transcript into structured digest — this is a summarization/cleanup task, not open-ended research, so hallucination risk is low when the full transcript is provided as grounding context.

**Output structure (500–1000 words total):**
```
GUEST: [name], [firm/title]
EPISODE FOCUS: [stated theme, e.g. "Energy Sector Outlook"]
MARKET OUTLOOK (100-150 words):
[Guest's overall market view/thesis for the episode, condensed from their opening remarks]

TOP PICKS:
[TICKER] — [Company Name]
"[Condensed reasoning in guest's own logic, 80-150 words per pick — WHY they like it,
any stated price target or timeframe, any specific catalyst or metric they referenced]"
[Repeat per pick — typically 3-8 picks per episode]

CLOSING NOTES (optional, 50-100 words):
[Any caller Q&A insights or risk caveats the guest mentioned]
```

> [!NOTE]
> **Estimated cost:** ~9,000 input tokens (transcript) + ~2,000 output tokens (digest) per generation using Claude Sonnet ≈ $0.038/day, or under $1/month at 20 trading days. Negligible relative to the 45 minutes/day of user time saved.

**Technical notes**
- New Vercel function `/api/marketcall-digest.js`: fetches today's MarketCall video ID (search YouTube Data API for "BNN Bloomberg Market Call" uploaded today), retrieves auto-generated transcript via YouTube transcript endpoint.
- New file `src/lib/digestBuilder.js`: constructs the summarization prompt, enforces the 500–1000 word output range, and enforces "only reference what the guest actually said — do not add outside analysis or opinion" as a strict rule.
- Digest generation prompt must instruct Claude to preserve the guest's specific language and reasoning rather than generic boilerplate (e.g. not "the guest is bullish" but the actual stated logic).
- Cache the digest in localStorage per date (`marketcall_digest_YYYY-MM-DD`) so it is generated once per day, not on every page load.
- New component `src/components/DigestView.jsx`: renders the digest with expandable pick cards.
- New component `src/components/DigestPickCard.jsx`: individual pick card with "Score This" button that navigates to main ScoreForm with ticker pre-filled.

**Out of scope for v1 of this feature**
- Historical digest archive/search across past episodes.
- Multi-guest digests (MarketCall features one guest per episode).
- Automatic scheduled generation without user action (v1 is on-demand, generated when user opens the tab).

**Success metric**
Digest generation completes in under 15 seconds and produces a 500–1000 word summary where every stock pick includes the guest's actual stated reasoning, verified by spot-checking 5 digests against manually watching the corresponding episode.

---

*End of PRD — RogueCFA.ai v1.0*
