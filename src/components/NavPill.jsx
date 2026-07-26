import React from 'react';
import { motion } from 'framer-motion';

const TABS = [
  { key: 'landing', label: 'Overview' },
  { key: 'score', label: 'Score Ticker' },
  { key: 'digest', label: 'Latest Picks' },
  { key: 'history', label: 'Score History' },
];

/**
 * NavPill — Powered by Framer Motion layoutId with initial={false}.
 * Clips perfectly inside outer container curves and glides smoothly
 * between tabs without flying in from the side on initial render.
 */
export default function NavPill({ activeTab, onTabChange }) {
  return (
    <nav className="relative flex items-center gap-1 bg-surface-card p-1 rounded-full shadow-inner text-xs overflow-hidden">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`relative px-4 py-1.5 rounded-full font-medium transition-colors duration-200 flex items-center justify-center select-none ${
              isActive ? 'text-prime font-semibold' : 'text-dim hover:text-prime'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeNavPill"
                initial={false}
                className="absolute inset-0 rounded-full bg-surface-elevated shadow-antigravity"
                transition={{
                  type: 'spring',
                  stiffness: 380,
                  damping: 30,
                }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
