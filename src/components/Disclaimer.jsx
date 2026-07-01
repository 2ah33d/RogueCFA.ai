export default function Disclaimer({ className = '' }) {
  return (
    <div className={`w-full bg-surface-card/50 border-t border-edge ${className}`}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-2">
        <svg
          className="w-4 h-4 text-signal-watch flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667
               1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082
               16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <p className="text-xs text-faint text-center">
          <strong className="text-dim">This is not financial advice.</strong>{' '}
          AI-generated analysis may contain errors. Verify independently before
          acting.
        </p>
      </div>
    </div>
  );
}
