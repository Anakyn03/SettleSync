'use client'

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto py-16 space-y-16">
      {/* Hero */}
      <div className="space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-[var(--ink)] flex items-center justify-center">
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <h1 className="text-[44px] font-bold leading-[1.1] tracking-[-0.03em]">
          Reconcile any<br />
          <span className="text-[var(--accent)]">transaction.</span>
        </h1>
        <p className="text-[var(--ink-soft)] text-base leading-relaxed max-w-md">
          Upload CSVs from Razorpay, your bank, or any source. 
          Rules handle the obvious. ML handles the rest.
        </p>
      </div>

      {/* CTA */}
      <a href="/upload" className="btn-primary inline-flex items-center gap-2 text-[15px]">
        Get started
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>

      {/* Steps */}
      <div className="grid grid-cols-3 gap-8">
        {[
          { n: '01', title: 'Upload', desc: 'Drop any CSV' },
          { n: '02', title: 'Match', desc: 'Rules + ML + AI' },
          { n: '03', title: 'Review', desc: 'Scores & export' },
        ].map(({ n, title, desc }) => (
          <div key={n} className="space-y-2">
            <span className="text-xs text-[var(--ink-muted)] font-medium tabular-nums">{n}</span>
            <h3 className="font-semibold text-[15px]">{title}</h3>
            <p className="text-sm text-[var(--ink-soft)]">{desc}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="border-t border-[var(--border)] pt-10 grid grid-cols-3 gap-8">
        {[
          { title: 'Three-tier matching', desc: 'Deterministic rules, local ML, and AI for edge cases.' },
          { title: 'Confidence scores', desc: 'Every match gets a 0–100% score with reasoning.' },
          { title: 'Pattern learning', desc: 'Discovers fee structures and settlement lags over time.' },
        ].map(({ title, desc }) => (
          <div key={title}>
            <h4 className="font-medium text-sm mb-1">{title}</h4>
            <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
