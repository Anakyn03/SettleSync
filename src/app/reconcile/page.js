'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function ReconcileContent() {
  const searchParams = useSearchParams()
  const [batchId, setBatchId] = useState(searchParams.get('batch') || '')
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const eventSourceRef = useRef(null)

  useEffect(() => () => { eventSourceRef.current?.close() }, [])

  const run = async () => {
    if (!batchId.trim()) return setError('Enter a batch ID')
    setStatus('running')
    setProgress({ phase: 'init', progress: 0, message: 'Starting...' })
    setError(''); setResults(null)

    const es = new EventSource(`/api/progress?batchId=${encodeURIComponent(batchId.trim())}`)
    eventSourceRef.current = es
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        setProgress(d)
        if (d.phase === 'completed' || d.phase === 'failed') es.close()
      } catch {}
    }

    try {
      const res = await fetch('/api/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId: batchId.trim() }) })
      es.close(); eventSourceRef.current = null
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data); setStatus('done')
      setProgress({ phase: 'completed', progress: 100, message: 'Done' })
    } catch (e) {
      es.close(); eventSourceRef.current = null
      setStatus('error'); setError(e.message)
    }
  }

  const s = results?.stats

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Reconcile</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1">Rules → ML → AI. Each run trains the classifier.</p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex gap-2">
          <input type="text" value={batchId} onChange={e => setBatchId(e.target.value)} placeholder="Batch ID" disabled={status === 'running'} onKeyDown={e => e.key === 'Enter' && run()} className="input font-mono text-sm flex-1" />
          <button onClick={run} disabled={!batchId.trim() || status === 'running'} className={status === 'running' ? 'btn-secondary text-sm cursor-wait' : 'btn-primary text-sm'}>
            {status === 'running' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Running
              </span>
            ) : 'Run'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-[#fafafa] rounded-lg px-3 py-2"><span className="font-medium">1</span> <span className="text-[var(--ink-soft)]">Deterministic</span></div>
          <div className="bg-[#fafafa] rounded-lg px-3 py-2"><span className="font-medium">2</span> <span className="text-[var(--ink-soft)]">ML Classifier</span></div>
          <div className="bg-[#fafafa] rounded-lg px-3 py-2"><span className="font-medium">3</span> <span className="text-[var(--ink-soft)]">Grok AI</span></div>
        </div>
      </div>

      {status === 'running' && progress && (
        <div className="card p-5 space-y-3 bg-[#f0fdfa] border border-[#99f6e4]">
          <div className="flex items-center gap-2.5">
            <svg className="animate-spin h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <span className="text-sm font-medium text-[var(--accent)]">{progress.message}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.progress || 0}%` }} />
          </div>
          <span className="text-xs text-[var(--accent)]">{progress.progress || 0}%</span>
        </div>
      )}

      {error && <div className="bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl">{error}</div>}

      {results && (
        <div className="card p-6 space-y-5">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: s.total, color: 'var(--ink)' },
              { label: 'Matched', value: s.matched, color: 'var(--accent)' },
              { label: 'Exceptions', value: s.exceptions, color: 'var(--danger)' },
              { label: 'Rate', value: `${s.matchRate}%`, color: 'var(--ink)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="stat">
                <div className="stat-value" style={{ color }}>{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-[var(--ink-muted)] space-y-1 bg-[#fafafa] rounded-lg px-4 py-3">
            <div>Rules: {results.pass1?.deterministic || 0}</div>
            <div>ML: {results.pass2?.mlMatched || 0} · Grok: {results.pass2?.grokMatched || 0} · Exceptions: {results.pass2?.grokExceptions || 0}</div>
          </div>

          <div className="flex gap-2">
            <a href={`/results?batch=${results.batchId}`} className="btn-primary text-sm flex-1 text-center">View results</a>
            <a href="/dashboard" className="btn-secondary text-sm">Dashboard</a>
          </div>
        </div>
      )}

      {!batchId && status === 'idle' && (
        <p className="text-center text-sm text-[var(--ink-muted)] py-8">
          No batch selected. <a href="/upload" className="text-[var(--accent)] underline">Upload files</a> first.
        </p>
      )}
    </div>
  )
}

export default function ReconcilePage() {
  return <Suspense fallback={<div className="text-center py-12 text-sm text-[var(--ink-muted)]">Loading...</div>}><ReconcileContent /></Suspense>
}
