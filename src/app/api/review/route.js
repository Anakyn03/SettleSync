import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function PATCH(request) {
  const { id, status, batchId } = await request.json()

  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
  }

  if (!['matched', 'exception', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be matched, exception, or rejected' }, { status: 400 })
  }

  const db = getSupabase()
  const { data, error } = await db
    .from('settlements')
    .update({
      status,
      match_reason: status === 'matched' ? 'manual-approve' : status === 'rejected' ? 'manual-reject' : null,
    })
    .eq('id', id)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If batchId provided, recalculate stats
  if (batchId) {
    const { data: all } = await db
      .from('settlements')
      .select('status')
      .eq('batch_id', batchId)

    if (all) {
      const matched = all.filter(r => r.status === 'matched').length
      const total = all.length
      await db
        .from('reconciliation_runs')
        .update({
          matched_count: matched,
          exception_count: total - matched,
          match_rate: total ? Math.round((matched / total) * 10000) / 100 : 0,
        })
        .eq('batch_id', batchId)
    }
  }

  return NextResponse.json({ record: data?.[0] })
}
