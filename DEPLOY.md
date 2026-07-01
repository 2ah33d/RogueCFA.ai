# RogueCFA.ai — READY TO DEPLOY Checklist

## Prerequisites

### 1. Install Dependencies
```bash
cd RogueCFA.ai
npm install
```

### 2. Install Vercel CLI (if not installed)
```bash
npm i -g vercel
```

### 3. API Keys You Need Before Testing

| Key | Where to Get It | Free? |
|-----|-----------------|-------|
| **Finnhub API Key** | [finnhub.io/register](https://finnhub.io/register) | ✅ Yes — 60 calls/min |
| **Gemini API Key** | [aistudio.google.com](https://aistudio.google.com/app/apikey) | ✅ Yes — free tier |
| **Claude API Key** *(optional)* | [console.anthropic.com](https://console.anthropic.com/) | ❌ Paid |
| **OpenAI API Key** *(optional)* | [platform.openai.com](https://platform.openai.com/api-keys) | ❌ Paid |

> You need **one** LLM key (Gemini recommended for free tier) + Finnhub.

---

## Local Development
```bash
vercel dev
```
This runs Vite + serverless functions together. Open `http://localhost:3000`.

> **Alternative** (frontend only, no API proxy):
> ```bash
> npm run dev
> ```
> Note: API calls to `/api/*` will fail without `vercel dev`.

---

## Production Deploy
```bash
vercel --prod
```

---

## File Manifest (20 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `package.json` | Dependencies (React 18, Vite) |
| 2 | `vite.config.js` | Vite + React plugin |
| 3 | `vercel.json` | Routing + framework config |
| 4 | `.env.example` | Documentation (no vars needed) |
| 5 | `index.html` | Entry HTML, Tailwind CDN, fonts |
| 6 | `api/finnhub.js` | Serverless proxy → Finnhub |
| 7 | `api/score.js` | Serverless proxy → LLM APIs |
| 8 | `src/lib/storage.js` | localStorage helpers |
| 9 | `src/lib/promptBuilder.js` | Time-weighted prompt construction |
| 10 | `src/lib/finnhub.js` | Client → Finnhub proxy |
| 11 | `src/lib/scorer.js` | Client → LLM proxy |
| 12 | `src/components/KeySetup.jsx` | First-run key entry modal |
| 13 | `src/components/ProviderSelect.jsx` | LLM provider dropdown |
| 14 | `src/components/SettingsPanel.jsx` | Slide-out settings panel |
| 15 | `src/components/ScoreForm.jsx` | Ticker + hold period form |
| 16 | `src/components/Scorecard.jsx` | Individual scorecard card |
| 17 | `src/components/ScorecardGrid.jsx` | Responsive card grid |
| 18 | `src/components/Disclaimer.jsx` | Persistent legal banner |
| 19 | `src/main.jsx` | React entry point |
| 20 | `src/App.jsx` | Main orchestrator + theme vars |

---

## Architecture

```
Browser
  ├─ POST /api/finnhub  →  Vercel Function  →  Finnhub API (profile, quote, consensus, news)
  ├─ Build prompt (client-side, time-weighted)
  └─ POST /api/score    →  Vercel Function  →  Gemini / Claude / OpenAI
                                              ↓
                                         JSON scorecard  →  Rendered card
```

- **Zero keys on any server** — BYOK via localStorage, sent in POST body over HTTPS
- **Zero database** — all state lives in the browser
- **All external calls server-side** — CORS solved, keys hidden from DevTools network tab
