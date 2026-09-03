'use client'

import { useState, useEffect } from 'react'

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [patterns, setPatterns] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const ts = Date.now()
    Promise.all([
      fetch(`/api/analytics?type=overview&_t=${ts}`).then(r => r.json()),
      fetch(`/api/analytics?type=patterns&_t=${ts}`).then(r => r.json()),
    ]).then(([d, p]) => { setData(d); setPatterns(p) })
      .catch(() => setError('Failed to load dashboard data. Make sure Supabase is configured.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="max-w-5xl mx-auto"><h1 className="text-2xl font-bold tracking-[-0.02em]">Dashboard</h1><p className="text-sm text-[var(--ink-muted)] mt-4">Loading...</p></div>

  const runs = data?.runs || []
  const patternList = patterns?.patterns || []
  const samples = patterns?.trainingSamples || 0
  const avgRate = runs.length ? (runs.reduce((s, r) => s + (r.match_rate || 0), 0) / runs.length).toFixed(1) : 0

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold tracking-[-0.02em]">Dashboard</h1>

      {error && <div className="bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { v: runs.length, l: 'Runs', c: 'var(--ink)' },
          { v: avgRate + '%', l: 'Avg rate', c: 'var(--accent)' },
          { v: patternList.length, l: 'Patterns', c: '#6366f1' },
          { v: samples, l: 'Training samples', c: '#f59e0b' },
        ].map(({ v, l, c }) => (
          <div key={l} className="stat"><div className="stat-value" style={{ color: c }}>{v}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>

      {/* Runs */}
      <div className="card p-6">
        <h2 className="font-semibold text-sm mb-4">Run history</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Batch', 'Status', 'Total', 'Matched', 'Rate', 'Date'].map(h => (
                    <th key={h} className={`px-3 py-2 text-[11px] font-medium text-[var(--ink-muted)] uppercase tracking-wide ${['Total', 'Matched', 'Rate'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f4f5]">
                {runs.map(run => (
                  <tr key={run.id} className="hover:bg-[#fafafa]">
                    <td className="px-3 py-2 font-mono text-xs">{run.batch_id}</td>
                    <td className="px-3 py-2"><span className={`badge ${run.status === 'completed' ? 'bg-[#f0fdf4] text-[var(--accent)]' : run.status === 'failed' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[#f4f4f5] text-[var(--ink-soft)]'}`}>{run.status}</span></td>
                    <td className="px-3 py-2 text-right text-xs">{run.total_records}</td>
                    <td className="px-3 py-2 text-right text-xs text-[var(--accent)]">{run.matched_count}</td>
                    <td className="px-3 py-2 text-right text-xs font-medium">{run.match_rate}%</td>
                    <td className="px-3 py-2 text-xs text-[var(--ink-muted)]">{new Date(run.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patterns */}
      <div className="card p-6">
        <h2 className="font-semibold text-sm mb-4">Learned patterns</h2>
        {patternList.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Run reconciliation a few times to discover patterns.</p>
        ) : (
          <div className="space-y-2">
            {patternList.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-[#fafafa] rounded-lg px-4 py-2.5">
                <div>
                  <span className="font-medium text-sm">{p.source}</span>
                  <span className="text-xs text-[var(--ink-muted)] ml-2">{p.pattern_type}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm">
                    {p.pattern_type === 'fee' ? `${(p.pattern_value.min_fee * 100).toFixed(1)}–${(p.pattern_value.max_fee * 100).toFixed(1)}%` : p.pattern_type === 'lag' ? `${(p.pattern_value.avg_lag_days || 0).toFixed(1)}d` : JSON.stringify(p.pattern_value)}
                  </span>
                  <span className="text-[10px] text-[var(--ink-muted)] ml-2">{p.sample_size} samples</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ML Status */}
      <div className="card p-6">
        <h2 className="font-semibold text-sm mb-4">ML classifier</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#fafafa] rounded-lg p-4 text-center">
            <div className={`text-lg font-bold ${samples >= 5 ? 'text-[var(--accent)]' : 'text-[#f59e0b]'}`}>{samples >= 5 ? 'Ready' : 'Warming up'}</div>
            <div className="text-xs text-[var(--ink-muted)] mt-1">Status</div>
          </div>
          <div className="bg-[#fafafa] rounded-lg p-4 text-center">
            <div className="text-lg font-bold">{samples}</div>
            <div className="text-xs text-[var(--ink-muted)] mt-1">Samples</div>
          </div>
          <div className="bg-[#fafafa] rounded-lg p-4 text-center">
            <div className="text-lg font-bold text-[var(--accent)]">{samples >= 20 ? 'High' : samples >= 10 ? 'Med' : 'Low'}</div>
            <div className="text-xs text-[var(--ink-muted)] mt-1">Confidence</div>
          </div>
        </div>
      </div>
    </div>
  )
}
