const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    model: 'gemini-2.0-flash',
    tag: 'Free tier',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    model: 'claude-sonnet-4-6',
    tag: 'Paid',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    model: 'gpt-4o-mini',
    tag: 'Paid',
  },
];

export default function ProviderSelect({ value, onChange, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-surface border border-edge rounded-lg
                   text-prime appearance-none cursor-pointer
                   focus:outline-none focus:border-accent focus:ring-1
                   focus:ring-accent/30 transition-colors"
      >
        {PROVIDERS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} — {p.model} ({p.tag})
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg
          className="w-4 h-4 text-dim"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
