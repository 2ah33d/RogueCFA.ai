import { useRef, useEffect, useState, useCallback } from 'react';

const TABS = [
  { key: 'landing', label: 'Overview' },
  { key: 'score', label: 'Score Ticker' },
  { key: 'digest', label: 'Latest Picks' },
  { key: 'history', label: 'Score History' },
];

/**
 * NavPill — Sliding pill navbar.
 * The active indicator glides between tabs with a smooth CSS transition
 * instead of appearing instantly.
 */
export default function NavPill({ activeTab, onTabChange }) {
  const navRef = useRef(null);
  const buttonRefs = useRef({});
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 });

  const updatePill = useCallback(() => {
    const navEl = navRef.current;
    const activeBtn = buttonRefs.current[activeTab];
    if (!navEl || !activeBtn) return;

    const navRect = navEl.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    setPillStyle({
      left: btnRect.left - navRect.left,
      width: btnRect.width,
      opacity: 1,
    });
  }, [activeTab]);

  /* Measure on mount + tab change */
  useEffect(() => {
    updatePill();
  }, [updatePill]);

  /* Re-measure on resize */
  useEffect(() => {
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill]);

  return (
    <nav
      ref={navRef}
      className="relative flex items-center gap-1 bg-surface-card p-1 rounded-full shadow-inner text-xs"
    >
      {/* Sliding pill indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-full bg-surface-elevated shadow-antigravity pointer-events-none"
        style={{
          left: pillStyle.left,
          width: pillStyle.width,
          opacity: pillStyle.opacity,
          transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease',
        }}
      />

      {/* Tab buttons */}
      {TABS.map((tab) => (
        <button
          key={tab.key}
          ref={(el) => { buttonRefs.current[tab.key] = el; }}
          onClick={() => onTabChange(tab.key)}
          className={`relative z-10 px-4 py-1.5 rounded-full transition-colors duration-200 font-medium ${
            activeTab === tab.key
              ? 'text-prime font-semibold'
              : 'text-dim hover:text-prime'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
