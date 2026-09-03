import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const type = new URL(request.url).searchParams.get('type') || 'overview'
  const db = getSupabase()

  try {
    if (type === 'overview') {
      const { data: runs, error } = await db
        .from('reconciliation_runs')
        .select('id, batch_id, status, total_records, matched_count, exception_count, match_rate, started_at, completed_at, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json({ runs: runs || [] })
    }

    if (type === 'patterns') {
      // Get all patterns, then deduplicate in code (keep highest confidence per source+type)
      const { data: allPatterns, error: pErr } = await db
        .from('source_patterns')
        .select('id, source, pattern_type, pattern_value, confidence, sample_size, last_updated')
        .order('confidence', { ascending: false })

      if (pErr) throw pErr

      // Deduplicate: keep highest confidence per source+pattern_type
      const seen = new Map()
      for (const p of allPatterns || []) {
        const key = `${p.source}:${p.pattern_type}`
        if (!seen.has(key)) seen.set(key, p)
      }
      const patterns = [...seen.values()]

      const { count: trainingSamples, error: tErr } = await db
        .from('learning_data')
        .select('*', { count: 'exact', head: true })

      if (tErr) throw tErr

      console.log(`Analytics: returning ${patterns.length} patterns, ${trainingSamples || 0} training samples`)
      return NextResponse.json({ patterns, trainingSamples: trainingSamples || 0, _ts: Date.now() }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (err) {
    console.error('Analytics error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
