import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request) {
  const params = new URL(request.url).searchParams
  const batchId = params.get('batchId')
  const format = params.get('format') || 'csv'

  if (!batchId) {
    return NextResponse.json({ error: 'batchId is required' }, { status: 400 })
  }

  const db = getSupabase()
  const { data: records, error } = await db
    .from('settlements')
    .select('*')
    .eq('batch_id', batchId)
    .order('source')
    .order('txn_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!records?.length) return NextResponse.json({ error: 'No records found' }, { status: 404 })

  if (format === 'json') {
    return NextResponse.json(records, {
      headers: {
        'Content-Disposition': `attachment; filename="audit_${batchId}.json"`,
      },
    })
  }

  // CSV
  const cols = ['id', 'source', 'txn_id', 'amount', 'txn_date', 'status', 'matched_with', 'match_reason', 'batch_id', 'created_at']
  const rows = [cols.join(',')]
  for (const r of records) {
    rows.push(cols.map(c => escapeCsv(r[c])).join(','))
  }

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Disposition': `attachment; filename="audit_${batchId}.csv"`,
      'Content-Type': 'text/csv',
    },
  })
}

function escapeCsv(val) {
  if (val == null) return ''
  const s = String(val)
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"`
    : s
}
