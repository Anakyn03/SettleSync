import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request) {
  const type = new URL(request.url).searchParams.get('type') || 'overview'
  const db = getSupabase()

  try {
    if (type === 'overview') {
      const { data: runs } = await db
        .from('reconciliation_runs')
        .select('id, batch_id, status, matched_count, exception_count, match_rate, started_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(10)

      return NextResponse.json({ runs: runs || [] })
    }

    if (type === 'patterns') {
      const { data: patterns } = await db
        .from('source_patterns')
        .select('source, pattern_type, confidence, sample_size, last_updated')
        .order('confidence', { ascending: false })

      const { count: trainingSamples } = await db
        .from('learning_data')
        .select('*', { count: 'exact', head: true })

      return NextResponse.json({ patterns: patterns || [], trainingSamples: trainingSamples || 0 })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
