import React from 'react';

/**
 * LandingPage — Marketing landing page for RogueCFA at root route.
 * Linear.app aesthetic: tiered dark #0C0C0D, 8% white opacity borders, signature proof stat headline.
 */
export default function LandingPage({ onLaunchTool, onSelectTicker, onSelectGuest }) {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-16 py-4 animate-fade-in font-sans">
      {/* ── 1. HERO SECTION ── */}
      <section className="text-center space-y-6 pt-4">
        {/* Signature Proof Stat as Headline */}
        <div className="space-y-2">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#EDEDED]">
            45 minutes → 2 minutes.
          </h1>
          <p className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#8A8F98] tracking-tight">
            ~$0.04 per digest.
          </p>
        </div>

        {/* Muted One-line Subhead */}
        <p className="text-xs sm:text-sm text-[#8A8F98] max-w-xl mx-auto leading-relaxed">
          BNN Bloomberg&apos;s daily MarketCall broadcast compressed into structured, trackable digests for retail investors who don&apos;t have 45 minutes a day.
        </p>

        {/* Primary CTA (Single Accent Color on Page) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onLaunchTool('score')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#5E6AD2] hover:bg-[#727DE6] text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-[#5E6AD2]/10"
          >
            Launch Tool
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>

        {/* ── Primary Visual: Split View (Before / After Transformation) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left pt-6">
          {/* Left: Raw Broadcast Representation */}
          <div className="bg-[#17181A] border border-white/[0.08] rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-[#8A8F98] pb-3 border-b border-white/[0.08]">
                <span className="font-mono text-[11px] uppercase tracking-wider">RAW BROADCAST</span>
                <span className="font-mono text-[11px] text-[#8A8F98]">45:00 · BNN Bloomberg</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="h-32 bg-[#1C1D1F] border border-white/[0.08] rounded-lg p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#8A8F98] bg-[#0C0C0D] px-2 py-0.5 rounded">LIVE VIDEO STREAM</span>
                    <span className="text-[10px] font-mono text-[#8A8F98]">45:00 / 45:00</span>
                  </div>
                  <p className="text-xs text-[#8A8F98] italic line-clamp-3 leading-relaxed">
                    &ldquo;So we really like Keyera here, dividend yield is strong, energy infrastructure is rebounding... but caller on line 3 wants to know about Tourmaline...&rdquo;
                  </p>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="h-1.5 w-full bg-[#1C1D1F] rounded-full overflow-hidden">
                    <div className="h-full w-full bg-[#8A8F98]/40" />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[#8A8F98]">
                    <span>00:00</span>
                    <span>Talking Head Broadcast</span>
                    <span>45:00</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-[#8A8F98] pt-2 border-t border-white/[0.08]">
              Unstructured video • 45 min time commitment • No performance tracking
            </div>
          </div>

          {/* Right: Compressed Structured Digest Card */}
          <div className="bg-[#17181A] border border-white/[0.08] rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-[#8A8F98] pb-3 border-b border-white/[0.08]">
                <span className="font-mono text-[11px] uppercase tracking-wider">STRUCTURED DIGEST</span>
                <span className="font-mono text-[11px] text-[#2EA043]">2-MIN READ</span>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold text-[#EDEDED]">Eric Nuttall</div>
                  <div className="text-xs text-[#8A8F98]">Senior Portfolio Manager · Ninepoint Partners</div>
                </div>
                <div className="text-xs text-[#EDEDED] leading-relaxed bg-[#1C1D1F] border border-white/[0.08] p-3 rounded-lg">
                  <span className="text-[#8A8F98] block text-[10px] font-mono uppercase mb-1">Market Outlook</span>
                  Nuttall sees Canadian energy infrastructure names trading at compressed multiples despite strong Q2 free cash flow generation.
                </div>
                <div className="bg-[#1C1D1F] border border-white/[0.08] p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#EDEDED]">KEY · Keyera Corp (TSX)</span>
                    <span className="text-xs font-mono text-[#2EA043]">+26.8% return</span>
                  </div>
                  <p className="text-xs text-[#8A8F98] mt-1 leading-relaxed">
                    High dividend coverage, low balance sheet leverage, beneficiary of Western Canadian gas egress expansion.
                  </p>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-[#8A8F98] pt-2 border-t border-white/[0.08]">
              Structured digest • 2 min read • 89% verified track record
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. PROOF OF ACCOUNTABILITY (Plain Text Row with Subtle Dividers) ── */}
      <section className="space-y-4 pt-4 border-t border-white/[0.08]">
        <div className="text-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">
            Verified Guest Track Records
          </h3>
          <p className="text-xs text-[#8A8F98] mt-1">
            Quietly grading BNN Bloomberg pundits over time against S&amp;P/TSX and S&amp;P 500 benchmarks.
          </p>
        </div>

        {/* Plain text row with subtle dividers — NO nested bordered boxes! */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 text-xs font-sans text-[#EDEDED]">
          <button
            type="button"
            onClick={() => onSelectGuest && onSelectGuest('Eric Nuttall')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-medium text-[#EDEDED]">Eric Nuttall</span>
            <span className="text-[#8A8F98] mx-2">·</span>
            <span className="font-mono text-[#2EA043]">89% win rate</span>
            <span className="text-[#8A8F98] mx-2">·</span>
            <span className="font-mono text-[#8A8F98]">9 picks</span>
          </button>

          <span className="text-white/10 hidden sm:inline">|</span>

          <button
            type="button"
            onClick={() => onSelectGuest && onSelectGuest('Brian Acker')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-medium text-[#EDEDED]">Brian Acker</span>
            <span className="text-[#8A8F98] mx-2">·</span>
            <span className="font-mono text-[#2EA043]">83% win rate</span>
            <span className="text-[#8A8F98] mx-2">·</span>
            <span className="font-mono text-[#8A8F98]">12 picks</span>
          </button>

          <span className="text-white/10 hidden sm:inline">|</span>

          <button
            type="button"
            onClick={() => onSelectGuest && onSelectGuest('Christine Poole')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-medium text-[#EDEDED]">Christine Poole</span>
            <span className="text-[#8A8F98] mx-2">·</span>
            <span className="font-mono text-[#2EA043]">80% win rate</span>
            <span className="text-[#8A8F98] mx-2">·</span>
            <span className="font-mono text-[#8A8F98]">10 picks</span>
          </button>

          <span className="text-white/10 hidden sm:inline">|</span>

          <button
            type="button"
            onClick={() => onSelectGuest && onSelectGuest('John Stephenson')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-medium text-[#EDEDED]">John Stephenson</span>
            <span className="text-[#8A8F98] mx-2">·</span>
            <span className="font-mono text-[#2EA043]">78% win rate</span>
            <span className="text-[#8A8F98] mx-2">·</span>
            <span className="font-mono text-[#8A8F98]">14 picks</span>
          </button>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS (3 Real Grounded Steps) ── */}
      <section className="space-y-6 pt-4 border-t border-white/[0.08]">
        <div className="text-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">
            How It Works
          </h3>
          <p className="text-xs text-[#8A8F98] mt-1">
            Grounded data pipeline from broadcast to verified scorecard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#17181A] border border-white/[0.08] rounded-lg p-5 space-y-2">
            <span className="font-mono text-xs font-bold text-[#8A8F98] block">01</span>
            <h4 className="text-sm font-semibold text-[#EDEDED]">Transcribe Broadcast</h4>
            <p className="text-xs text-[#8A8F98] leading-relaxed">
              Automated audio pipeline captures BNN Bloomberg&apos;s daily MarketCall episodes from YouTube and RSS feeds into full text transcripts.
            </p>
          </div>

          <div className="bg-[#17181A] border border-white/[0.08] rounded-lg p-5 space-y-2">
            <span className="font-mono text-xs font-bold text-[#8A8F98] block">02</span>
            <h4 className="text-sm font-semibold text-[#EDEDED]">Extract Picks &amp; Q&amp;A</h4>
            <p className="text-xs text-[#8A8F98] leading-relaxed">
              Zero-LLM scraper extracts review tables directly from source articles to record historical entry prices, return tables, and review dates.
            </p>
          </div>

          <div className="bg-[#17181A] border border-white/[0.08] rounded-lg p-5 space-y-2">
            <span className="font-mono text-xs font-bold text-[#8A8F98] block">03</span>
            <h4 className="text-sm font-semibold text-[#EDEDED]">Grade Analyst Records</h4>
            <p className="text-xs text-[#8A8F98] leading-relaxed">
              Benchmark-adjusted alpha (S&amp;P/TSX &amp; S&amp;P 500) and Bayesian shrinkage compute objective accuracy scores over time.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. EMBEDDED SAMPLE DIGEST ── */}
      <section className="space-y-4 pt-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">
              Sample MarketCall Digest
            </h3>
            <p className="text-xs text-[#8A8F98] mt-0.5">
              Example output generated from live BNN Bloomberg episode.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onLaunchTool('digest')}
            className="text-xs text-[#8A8F98] hover:text-[#EDEDED] font-medium transition-colors"
          >
            Browse All Digests →
          </button>
        </div>

        <div className="bg-[#17181A] border border-white/[0.08] rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <span className="text-sm font-semibold text-[#EDEDED]">Eric Nuttall</span>
              <span className="text-xs text-[#8A8F98] block">Ninepoint Partners · Senior Portfolio Manager</span>
            </div>
            <span className="font-mono text-xs text-[#8A8F98] bg-[#1C1D1F] border border-white/[0.08] px-2.5 py-1 rounded-full">
              Episode: 2026-07-24
            </span>
          </div>

          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98] mb-1.5">
              Market Outlook
            </h5>
            <p className="text-xs text-[#EDEDED] leading-relaxed">
              Nuttall believes Canadian energy infrastructure names are significantly undervalued relative to US peers. Free cash flow yields across TSX midstream equities remain above 12%, offering downside margin of safety despite broader macro volatility.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98] mb-2">
              Top Pick
            </h5>
            <div className="bg-[#1C1D1F] border border-white/[0.08] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#EDEDED]">KEY · Keyera Corp (TSX)</span>
                <span className="font-mono text-xs text-[#2EA043]">+26.8% Total Return</span>
              </div>
              <p className="text-xs text-[#8A8F98] leading-relaxed">
                Strong Q2 cash flow results, 6.2% dividend yield backed by long-term take-or-pay contracts, and key exposure to Western Canadian natural gas processing infrastructure.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onSelectTicker && onSelectTicker('KEY', 'Eric Nuttall')}
                  className="text-xs text-[#EDEDED] hover:underline font-medium transition-colors"
                >
                  Score KEY Stock Ticker →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. SIMPLE CTA ── */}
      <section className="text-center space-y-4 pt-6 pb-8 border-t border-white/[0.08]">
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#EDEDED]">
          Score any stock ticker in seconds.
        </h3>
        <p className="text-xs text-[#8A8F98] max-w-md mx-auto">
          Free, Bring Your Own Key (BYOK), zero accounts required.
        </p>
        <div>
          <button
            type="button"
            onClick={() => onLaunchTool('score')}
            className="inline-flex items-center gap-2 px-8 py-3 bg-[#5E6AD2] hover:bg-[#727DE6] text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-[#5E6AD2]/10"
          >
            Launch RogueCFA Tool
          </button>
        </div>
      </section>
    </div>
  );
}
