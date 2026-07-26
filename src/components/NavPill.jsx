import React from 'react';
import { motion } from 'framer-motion';

const TABS = [
  { key: 'landing', label: 'Overview' },
  { key: 'score', label: 'Score Ticker' },
  { key: 'digest', label: 'Latest Picks' },
  { key: 'history', label: 'Score History' },
];

/**
 * NavPill — Powered by Framer Motion layoutId.
 * The active pill indicator glides automatically between tab buttons
 * with buttery-smooth spring physics, zero DOM bounding box math required.
 */
export default function NavPill({ activeTab, onTabChange }) {
  return (
    <nav className="relative flex items-center gap-1 bg-surface-card p-1 rounded-full shadow-inner text-xs">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`relative px-4 py-1.5 rounded-full font-medium transition-colors duration-200 ${
              isActive ? 'text-prime font-semibold' : 'text-dim hover:text-prime'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeNavPill"
                className="absolute inset-0 rounded-full bg-surface-elevated shadow-antigravity"
                transition={{
                  type: 'spring',
                  stiffness: 400,
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
