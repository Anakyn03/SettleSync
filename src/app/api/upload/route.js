import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const { source, rows, batchId } = await request.json()

    if (!source || typeof source !== 'string' || source.trim().length === 0) {
      return NextResponse.json({ error: 'Source name is required' }, { status: 400 })
    }
    const normalizedSource = source.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 })
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows to upload' }, { status: 400 })
    }

    // Validate and deduplicate rows
    const validRows = []
    const errors = []
    const seen = new Set()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const num = i + 1

      if (!row.txn_id?.trim()) {
        errors.push(`Row ${num}: missing txn_id`)
        continue
      }

      const amount = parseFloat(row.amount)
      if (isNaN(amount)) {
        errors.push(`Row ${num}: invalid amount "${row.amount}"`)
        continue
      }

      if (!row.date || isNaN(Date.parse(row.date))) {
        errors.push(`Row ${num}: invalid date "${row.date}"`)
        continue
      }

      const txnId = row.txn_id.trim()
      if (seen.has(txnId)) {
        errors.push(`Row ${num}: duplicate txn_id "${txnId}" (skipped)`)
        continue
      }
      seen.add(txnId)

      validRows.push({
        source: normalizedSource,
        txn_id: txnId,
        amount,
        txn_date: row.date,
        status: 'unmatched',
        batch_id: batchId,
      })
    }

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows after validation', errors, inserted: 0 }, { status: 400 })
    }

    const db = getSupabase()

    // Check database for existing duplicates in this batch+source
    const { data: existing } = await db
      .from('settlements')
      .select('txn_id')
      .eq('batch_id', batchId)
      .eq('source', normalizedSource)

    const existingIds = new Set((existing || []).map(r => r.txn_id))
    const newRows = validRows.filter(r => {
      if (existingIds.has(r.txn_id)) {
        errors.push(`txn_id "${r.txn_id}" already exists (skipped)`)
        return false
      }
      return true
    })

    if (newRows.length === 0) {
      return NextResponse.json({ error: 'All rows already exist', errors, inserted: 0 }, { status: 400 })
    }

    const { data, error: insertError } = await db
      .from('settlements')
      .insert(newRows)
      .select()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      inserted: data.length,
      errors: errors.length ? errors : undefined,
      source: normalizedSource,
      batchId,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
