import { useRef, useLayoutEffect, useState, useCallback } from 'react';

const TABS = [
  { key: 'landing', label: 'Overview' },
  { key: 'score', label: 'Score Ticker' },
  { key: 'digest', label: 'Latest Picks' },
  { key: 'history', label: 'Score History' },
];

/**
 * NavPill — Sliding pill navbar.
 * Uses useLayoutEffect to measure before first paint so the pill
 * never appears in an awkward initial position.
 */
export default function NavPill({ activeTab, onTabChange }) {
  const navRef = useRef(null);
  const buttonRefs = useRef({});
  const [pillStyle, setPillStyle] = useState(null);
  const [ready, setReady] = useState(false);

  const updatePill = useCallback(() => {
    const navEl = navRef.current;
    const activeBtn = buttonRefs.current[activeTab];
    if (!navEl || !activeBtn) return;

    const navRect = navEl.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    setPillStyle({
      left: btnRect.left - navRect.left,
      width: btnRect.width,
    });

    if (!ready) setReady(true);
  }, [activeTab, ready]);

  /* useLayoutEffect measures before browser paint — no flash */
  useLayoutEffect(() => {
    updatePill();
  }, [updatePill]);

  /* Re-measure on resize */
  useLayoutEffect(() => {
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill]);

  return (
    <nav
      ref={navRef}
      className="relative flex items-center gap-1 bg-surface-card p-1 rounded-full shadow-inner text-xs"
    >
      {/* Sliding pill indicator — hidden until measured */}
      {pillStyle && (
        <div
          className="absolute top-1 bottom-1 rounded-full bg-surface-elevated shadow-antigravity pointer-events-none"
          style={{
            left: pillStyle.left,
            width: pillStyle.width,
            /* Only transition after first measurement */
            transition: ready
              ? 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
              : 'none',
          }}
        />
      )}

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
