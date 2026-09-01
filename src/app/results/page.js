'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const PALETTE = ['#0d9488','#6366f1','#f59e0b','#ec4899','#8b5cf6','#0ea5e9','#f97316','#10b981']
function srcColor(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return PALETTE[Math.abs(h) % PALETTE.length] }

function ResultsContent() {
  const searchParams = useSearchParams()
  const [batchId, setBatchId] = useState(searchParams.get('batch') || '')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')

  const load = async () => {
    if (!batchId.trim()) return
    setLoading(true); setError(''); setRecords([])
    try {
      const res = await fetch(`/api/results?batchId=${encodeURIComponent(batchId.trim())}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setRecords(d.records || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (batchId) load() }, [batchId])

  const stats = {
    total: records.length,
    matched: records.filter(r => r.status === 'matched').length,
    exceptions: records.filter(r => r.status === 'exception').length,
  }
  stats.rate = stats.total ? Math.round((stats.matched / stats.total) * 10000) / 100 : 0

  const groups = {}
  for (const r of records) { if (!groups[r.source]) groups[r.source] = []; groups[r.source].push(r) }

  const filtered = tab === 'all' ? records : tab === 'exceptions' ? records.filter(r => r.status === 'exception') : records.filter(r => r.status === 'matched')

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Results</h1>
          {batchId && <span className="text-xs text-[var(--ink-muted)] font-mono mt-1 block">{batchId}</span>}
        </div>
        {records.length > 0 && (
          <div className="flex gap-1.5">
            <button onClick={() => window.open(`/api/export?batchId=${batchId}&format=csv`)} className="btn-secondary text-xs py-1.5 px-3">CSV</button>
            <button onClick={() => window.open(`/api/export?batchId=${batchId}&format=json`)} className="btn-secondary text-xs py-1.5 px-3">JSON</button>
          </div>
        )}
      </div>

      {!records.length && !loading && (
        <div className="card p-6 max-w-sm">
          <label className="block text-xs text-[var(--ink-muted)] mb-1.5">Batch ID</label>
          <div className="flex gap-2">
            <input type="text" value={batchId} onChange={e => setBatchId(e.target.value)} placeholder="a1b2c3d4" className="input font-mono text-sm flex-1" onKeyDown={e => e.key === 'Enter' && load()} />
            <button onClick={load} disabled={!batchId.trim() || loading} className="btn-primary text-sm">{loading ? '...' : 'Load'}</button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-12 text-sm text-[var(--ink-muted)]">Loading...</div>}
      {error && <div className="bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl max-w-sm">{error}</div>}

      {records.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { v: stats.total, l: 'Total', c: 'var(--ink)' },
              { v: stats.matched, l: 'Matched', c: 'var(--accent)' },
              { v: stats.exceptions, l: 'Exceptions', c: 'var(--danger)' },
              { v: `${stats.rate}%`, l: 'Rate', c: 'var(--ink)' },
            ].map(({ v, l, c }) => (
              <div key={l} className="stat"><div className="stat-value" style={{ color: c }}>{v}</div><div className="stat-label">{l}</div></div>
            ))}
          </div>

          {/* Sources */}
          <div className="flex gap-4">
            {Object.entries(groups).map(([src, recs]) => (
              <div key={src} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full" style={{ background: srcColor(src) }} />
                <span className="font-medium">{src}</span>
                <span className="text-[var(--ink-muted)]">{recs.length}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--border)]">
            {[
              ['all', `All (${records.length})`],
              ['exceptions', `Exceptions (${stats.exceptions})`],
              ['matched', `Matched (${stats.matched})`],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-soft)]'}`}>{l}</button>
            ))}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Source', 'Txn ID', 'Amount', 'Date', 'Status', 'Reason'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-[11px] font-medium text-[var(--ink-muted)] uppercase tracking-wide ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f4f5]">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="px-4 py-2.5"><span className="badge text-[10px] font-medium" style={{ background: srcColor(r.source) + '18', color: srcColor(r.source) }}>{r.source}</span></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--ink-soft)]">{r.txn_id}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">₹{Number(r.amount).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-xs text-[var(--ink-muted)]">{r.txn_date}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`badge ${r.status === 'matched' ? 'bg-[#f0fdf4] text-[var(--accent)]' : r.status === 'exception' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[#fffbeb] text-[#b45309]'}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--ink-muted)] max-w-[200px] truncate">{r.match_reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function ResultsPage() {
  return <Suspense fallback={<div className="text-center py-12 text-sm text-[var(--ink-muted)]">Loading...</div>}><ResultsContent /></Suspense>
}
