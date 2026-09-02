import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request) {
  const batchId = new URL(request.url).searchParams.get('batchId')
  if (!batchId) {
    return NextResponse.json({ error: 'batchId is required' }, { status: 400 })
  }

  const db = getSupabase()
  const { data, error } = await db
    .from('settlements')
    .select('id, source, txn_id, amount, txn_date, status, match_reason, confidence, batch_id, matched_with')
    .eq('batch_id', batchId)
    .order('source')
    .order('txn_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'No records found' }, { status: 404 })

  return NextResponse.json({ records: data })
}
