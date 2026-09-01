import './globals.css'

export const metadata = {
  title: 'SettleSync',
  description: 'Reconcile transactions across any source.',
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--surface)] text-[var(--ink)] antialiased">
        <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-[var(--border)]">
          <div className="max-w-[1200px] mx-auto px-6 h-12 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-[var(--ink)] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <span className="font-semibold text-[15px] tracking-[-0.02em]">SettleSync</span>
            </a>
            <div className="flex items-center gap-0.5">
              {[
                ['Upload', '/upload'],
                ['Reconcile', '/reconcile'],
                ['Results', '/results'],
                ['Dashboard', '/dashboard'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="px-3 py-1.5 text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[#f4f4f5] rounded-lg transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </nav>
        <main className="max-w-[1200px] mx-auto px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  )
}
