'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'

const SAMPLE_SCENARIOS = [
  { id: '01-perfect-match', label: 'Perfect Match', desc: '40 records, 100% match rate', files: ['razorpay', 'bank', 'internal'] },
  { id: '02-fee-adjusted', label: 'Fee Adjusted', desc: '35 records, bank takes 2% fee', files: ['razorpay', 'bank', 'internal'] },
  { id: '03-date-shifted', label: 'Date Shifted', desc: '45 records, bank settles 2-3 days late', files: ['razorpay', 'bank', 'internal'] },
  { id: '04-mixed', label: 'Mixed Realistic', desc: '50 records, exact + fee + date-shifted', files: ['razorpay', 'bank', 'internal'] },
  { id: '05-no-matches', label: 'No Matches', desc: '25 records, zero overlap', files: ['razorpay', 'bank', 'internal'] },
  { id: '06-large', label: 'Large Dataset', desc: '200 records per source', files: ['razorpay', 'bank', 'internal'] },
  { id: '07-edge-amounts', label: 'Edge Amounts', desc: '₹0.01 to ₹999,999', files: ['razorpay', 'bank', 'internal'] },
  { id: '08-with-duplicates', label: 'With Duplicates', desc: '40 records + duplicate IDs', files: ['razorpay', 'bank', 'internal'] },
  { id: '09-malformed', label: '⚠ Malformed CSV', desc: 'Missing fields, bad data', files: ['razorpay', 'bank', 'internal'], failure: true },
  { id: '10-empty', label: '⚠ Empty Files', desc: 'Headers only, no records', files: ['razorpay', 'bank', 'internal'], failure: true },
  { id: '11-wrong-columns', label: '⚠ Wrong Columns', desc: 'Non-standard header names', files: ['razorpay', 'bank', 'internal'], failure: true },
  { id: '12-heavy-duplicates', label: '⚠ Heavy Duplicates', desc: 'Same ID repeated 3x', files: ['razorpay', 'bank', 'internal'], failure: true },
  { id: '13-special-chars', label: '⚠ Special Chars', desc: 'Commas, quotes, negatives', files: ['razorpay', 'bank', 'internal'], failure: true },
]

function parseCsvText(text, fileName) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true, skipEmptyLines: true, trimHeaders: true,
      complete: (results) => {
        if (results.errors.length > 0) return reject(new Error(results.errors[0].message))
        const headers = Object.keys(results.data[0] || {}).map(h => h.toLowerCase().trim())
        const rows = results.data.map(row => {
          const n = {}
          for (const [k, v] of Object.entries(row)) n[k.toLowerCase().trim()] = v
          return n
        })
        const detect = (c) => headers.find(h => c.some(x => h.includes(x))) || ''
        resolve({
          name: fileName, headers, rows,
          mapping: { txn_id: detect(['txn', 'id', 'transaction', 'order']), amount: detect(['amount', 'value', 'price', 'total']), date: detect(['date', 'time', 'timestamp']) },
          sourceName: fileName,
        })
      },
      error: reject,
    })
  })
}

export default function UploadPage() {
  const [step, setStep] = useState(0) // 0=pick, 1=map, 2=name, 3=review, 4=done
  const [batchId, setBatchId] = useState('')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [loadingSample, setLoadingSample] = useState(false)

  const [selectedScenario, setSelectedScenario] = useState(null)

  const loadSample = useCallback(async (scenario) => {
    setLoadingSample(true); setError('')
    setBatchId(uuidv4().slice(0, 8))
    try {
      const parsed = []
      for (const name of scenario.files) {
        const res = await fetch(`/data/samples/${scenario.id}/${name}.csv`)
        if (!res.ok) throw new Error(`Failed to load ${name}`)
        const text = await res.text()
        parsed.push(await parseCsvText(text, name))
      }
      setFiles(parsed); setStep(1)
    } catch (e) { setError(e.message) }
    finally { setLoadingSample(false) }
  }, [])

  const handleFiles = useCallback((e) => {
    const newFiles = Array.from(e.target.files || [])
    if (!newFiles.length) return
    if (!batchId) setBatchId(uuidv4().slice(0, 8))
    setError('')

    let completed = 0
    const parsed = newFiles.map(f => ({ file: f, name: f.name.replace('.csv', ''), headers: [], rows: [], mapping: { txn_id: '', amount: '', date: '' }, sourceName: '' }))

    parsed.forEach((item, idx) => {
      Papa.parse(item.file, { header: true, skipEmptyLines: true, trimHeaders: true,
        complete: (res) => {
          if (res.errors.length > 0) { setError(`${item.name}: ${res.errors[0].message}`); return }
          const h = Object.keys(res.data[0] || {}).map(x => x.toLowerCase().trim())
          parsed[idx].headers = h
          parsed[idx].rows = res.data.map(r => { const n = {}; for (const [k, v] of Object.entries(r)) n[k.toLowerCase().trim()] = v; return n })
          const d = (c) => h.find(x => c.some(y => x.includes(y))) || ''
          parsed[idx].mapping = { txn_id: d(['txn', 'id', 'transaction', 'order']), amount: d(['amount', 'value', 'price', 'total']), date: d(['date', 'time', 'timestamp']) }
          parsed[idx].sourceName = item.name
          if (++completed === parsed.length) { setFiles([...parsed]); setStep(1) }
        },
      })
    })
  }, [batchId])

  const updateMapping = (i, f, v) => { const u = [...files]; u[i].mapping[f] = v; setFiles(u) }
  const updateName = (i, n) => { const u = [...files]; u[i].sourceName = n; setFiles(u) }

  const handleUpload = async () => {
    setUploading(true); setError(''); const res = []
    for (const item of files) {
      const { txn_id, amount, date } = item.mapping
      if (!txn_id || !amount || !date) { res.push({ name: item.name, error: 'Map all three columns' }); continue }
      const rows = item.rows.map(r => ({ txn_id: r[txn_id]?.trim() || '', amount: r[amount], date: r[date] })).filter(r => r.txn_id && r.amount && r.date)
      if (!rows.length) { res.push({ name: item.name, error: 'No valid rows' }); continue }
      try {
        const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: item.sourceName.toLowerCase().replace(/[^a-z0-9]/g, '_'), rows, batchId }) })
        const d = await r.json()
        if (!r.ok) res.push({ name: item.name, error: d.error || 'Failed' })
        else res.push({ name: item.name, inserted: d.inserted })
      } catch (e) { res.push({ name: item.name, error: e.message }) }
    }
    setResults(res); setUploading(false); setStep(4)
  }

  const allMapped = files.every(f => f.mapping.txn_id && f.mapping.amount && f.mapping.date && f.sourceName)
  const hasSuccess = results.some(r => r.inserted)

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Upload</h1>
        {batchId && <span className="inline-block mt-2 text-xs text-[var(--ink-muted)] font-mono bg-[#f4f4f5] px-2.5 py-1 rounded-md">{batchId}</span>}
      </div>

      {/* Steps */}
      {step < 4 && (
        <div className="flex items-center gap-1.5">
          {['Pick', 'Map', 'Name', 'Confirm'].map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${i < step ? 'bg-[var(--accent)] text-white' : i === step ? 'bg-[var(--ink)] text-white' : 'bg-[#f4f4f5] text-[var(--ink-muted)]'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink-muted)]'}`}>{s}</span>
              {i < 3 && <div className="w-4 h-px bg-[var(--border)]" />}
            </div>
          ))}
        </div>
      )}

      {error && <div className="bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Step 0: Pick */}
      {step === 0 && (
        <div className="card p-10">
          <div className="space-y-4">
            <label className="flex flex-col items-center gap-3 p-8 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--ink-muted)] hover:bg-[#fafafa] transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--ink-soft)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </div>
              <span className="text-sm font-medium">Upload your CSVs</span>
              <span className="text-xs text-[var(--ink-muted)]">Any format</span>
              <input type="file" accept=".csv" multiple onChange={handleFiles} className="hidden" />
            </label>
            <div>
              <p className="text-xs text-[var(--ink-muted)] mb-2">Or try a sample scenario:</p>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_SCENARIOS.filter(s => !s.failure).map(s => (
                  <button key={s.id} onClick={() => loadSample(s)} disabled={loadingSample} className="text-left p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[#f0fdfa] transition-colors disabled:opacity-50">
                    <div className="text-sm font-medium">{loadingSample ? '...' : s.label}</div>
                    <div className="text-xs text-[var(--ink-muted)]">{s.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--ink-muted)] mb-2 mt-4">Failure demos (graceful degradation):</p>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_SCENARIOS.filter(s => s.failure).map(s => (
                  <button key={s.id} onClick={() => loadSample(s)} disabled={loadingSample} className="text-left p-3 rounded-lg border border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50">
                    <div className="text-sm font-medium text-amber-700">{loadingSample ? '...' : s.label}</div>
                    <div className="text-xs text-amber-600">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Map */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="card p-6 space-y-5">
            <p className="text-sm text-[var(--ink-soft)]">Map the <strong>Transaction ID</strong>, <strong>Amount</strong>, and <strong>Date</strong> columns.</p>
            {files.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-[#fafafa] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="text-xs text-[var(--ink-muted)]">{item.rows.length} rows</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {['txn_id', 'amount', 'date'].map(field => (
                    <div key={field}>
                      <label className="block text-xs text-[var(--ink-muted)] mb-1">{field === 'txn_id' ? 'Transaction ID' : field === 'amount' ? 'Amount' : 'Date'}</label>
                      <select value={item.mapping[field]} onChange={(e) => updateMapping(idx, field, e.target.value)} className="select">
                        <option value="">Select...</option>
                        {item.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {item.mapping.txn_id && item.mapping.amount && item.mapping.date && (
                  <div className="text-xs text-[var(--ink-muted)] bg-white rounded-lg px-3 py-2">
                    {item.rows[0]?.[item.mapping.txn_id]} · ₹{item.rows[0]?.[item.mapping.amount]} · {item.rows[0]?.[item.mapping.date]}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => { setStep(0); setFiles([]) }} className="btn-secondary text-sm">← Back</button>
            <button onClick={() => setStep(2)} disabled={!allMapped} className="btn-primary text-sm">Next →</button>
          </div>
        </div>
      )}

      {/* Step 2: Name */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <p className="text-sm text-[var(--ink-soft)]">Name each source.</p>
            {files.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-[var(--ink-muted)] mb-1">{item.name}</label>
                  <input type="text" value={item.sourceName} onChange={(e) => updateName(idx, e.target.value)} placeholder="e.g. Razorpay, HDFC" className="input" />
                </div>
                <span className="text-xs text-[var(--ink-muted)] pt-5">{item.rows.length}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary text-sm">← Back</button>
            <button onClick={() => setStep(3)} disabled={!files.every(f => f.sourceName)} className="btn-primary text-sm">Next →</button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-6 space-y-3">
            <p className="text-sm font-medium mb-2">Review</p>
            {files.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-[#fafafa] rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium text-sm">{item.sourceName}</span>
                  <span className="text-xs text-[var(--ink-muted)] ml-2">{item.mapping.txn_id} · {item.mapping.amount} · {item.mapping.date}</span>
                </div>
                <span className="text-xs text-[var(--ink-muted)]">{item.rows.length} rows</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-secondary text-sm">← Back</button>
            <button onClick={handleUpload} disabled={uploading} className="btn-accent text-sm">
              {uploading ? 'Uploading...' : `Upload ${files.length} files`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="card p-6 space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm ${r.error ? 'bg-[var(--danger-soft)]' : 'bg-[#f0fdf4]'}`}>
                <span className="font-medium">{r.name}</span>
                <span className={`text-xs ${r.error ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}`}>
                  {r.error || `${r.inserted} records`}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => { setStep(0); setFiles([]); setResults([]); setError('') }} className="btn-secondary text-sm">Upload more</button>
            {hasSuccess && <a href={`/reconcile?batch=${batchId}`} className="btn-primary text-sm">Reconcile →</a>}
          </div>
        </div>
      )}
    </div>
  )
}
