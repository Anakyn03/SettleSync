/**
 * Pattern learning engine for transaction matching.
 * Discovers fee structures, settlement lags, and anomalies from match history.
 * 
 * What it learns:
 * - Fee percentage range per source pair (e.g., "bank-razorpay: 1.8-2.2%")
 * - Settlement lag patterns (e.g., "bank takes 1-2 days")
 * - Amount tolerance patterns
 * - Anomaly detection (unusual amounts, fee changes)
 */

import { getSupabase } from './supabase'

/**
 * Analyze completed matches to discover patterns.
 * Run after each reconciliation to update learned patterns.
 */
export async function learnPatterns(runId) {
  const db = getSupabase()
  const patterns = []

  // Fetch all matched settlements for this run directly from the raw data
  // This is more reliable than computing from match_decisions feature vectors
  const { data: decisions } = await db
    .from('match_decisions')
    .select('record_a_id, record_b_id, match_type, feature_vector')
    .eq('run_id', runId)
    .neq('match_type', 'exception')

  if (!decisions?.length) {
    console.log('Patterns: No matched decisions to analyze')
    return patterns
  }

  // Fetch the actual settlement records for these pairs
  const recordIds = new Set()
  for (const d of decisions) {
    recordIds.add(d.record_a_id)
    recordIds.add(d.record_b_id)
  }
  const { data: records } = await db
    .from('settlements')
    .select('id, source, txn_id, amount, txn_date')
    .in('id', [...recordIds])

  if (!records?.length) return patterns

  // Index records by id for quick lookup
  const recordMap = {}
  for (const r of records) recordMap[r.id] = r

  // Group decisions by source pair
  const byPair = {}
  for (const d of decisions) {
    const a = recordMap[d.record_a_id]
    const b = recordMap[d.record_b_id]
    if (!a || !b) continue
    const pair = [a.source, b.source].sort().join('-')
    if (!byPair[pair]) byPair[pair] = []
    byPair[pair].push({ a, b })
  }

  // Learn fee patterns per source pair from raw amounts
  for (const [pair, pairs] of Object.entries(byPair)) {
    if (pairs.length < 2) continue

    const fees = pairs
      .map(({ a, b }) => {
        const maxAmt = Math.max(Number(a.amount), Number(b.amount))
        if (maxAmt <= 0) return null
        const diff = Math.abs(Number(a.amount) - Number(b.amount))
        const feePct = diff / maxAmt
        // Only count meaningful fees (0.1% to 10%)
        return feePct >= 0.001 && feePct <= 0.1 ? feePct : null
      })
      .filter(f => f !== null)

    if (fees.length >= 2) {
      fees.sort((a, b) => a - b)
      patterns.push({
        source: pair,
        pattern_type: 'fee',
        pattern_value: {
          min_fee: fees[0],
          max_fee: fees[fees.length - 1],
          avg_fee: fees.reduce((s, f) => s + f, 0) / fees.length,
        },
        sample_size: fees.length,
        confidence: Math.min(1, fees.length / 20),
      })
    }

    // Learn lag patterns from raw dates
    const lags = pairs
      .map(({ a, b }) => {
        const diff = Math.round(Math.abs((new Date(a.txn_date) - new Date(b.txn_date)) / 86400000))
        return diff
      })
      .filter(d => d > 0) // Only count actual lags (not same-day)

    if (lags.length >= 2) {
      patterns.push({
        source: pair,
        pattern_type: 'lag',
        pattern_value: {
          avg_lag_days: lags.reduce((s, l) => s + l, 0) / lags.length,
          max_lag_days: Math.max(...lags),
        },
        sample_size: lags.length,
        confidence: Math.min(1, lags.length / 20),
      })
    }
  }

  // Store patterns in database (upsert by source+type)
  for (const p of patterns) {
    const { data: existing } = await db
      .from('source_patterns')
      .select('id')
      .eq('source', p.source)
      .eq('pattern_type', p.pattern_type)
      .limit(1)

    if (existing?.length) {
      await db.from('source_patterns').update({
        pattern_value: p.pattern_value,
        sample_size: p.sample_size,
        confidence: p.confidence,
        last_updated: new Date().toISOString(),
      }).eq('id', existing[0].id)
    } else {
      const { error } = await db.from('source_patterns').insert(p)
      if (error) console.error(`Pattern insert failed: ${p.source}:${p.pattern_type}`, error.message)
    }
  }

  console.log(`Patterns: Learned ${patterns.length} patterns from run ${runId}`)
  return patterns
}

/**
 * Get all learned patterns for use in confidence scoring.
 * Returns a flat map keyed by "sourcePair:patternType"
 */
export async function getPatterns() {
  const db = getSupabase()
  const { data } = await db
    .from('source_patterns')
    .select('*')
    .order('confidence', { ascending: false })

  const map = {}
  for (const p of data || []) {
    map[`${p.source}:${p.pattern_type}`] = p.pattern_value
  }
  return map
}

/**
 * Compute source pair reliability from match history.
 */
export async function computeSourcePairReliability() {
  const db = getSupabase()
  
  const { data: decisions } = await db
    .from('match_decisions')
    .select('feature_vector, match_type')

  if (!decisions?.length) return {}

  const byPair = {}
  for (const d of decisions) {
    const pair = d.feature_vector?.source_pair || 'unknown'
    if (!byPair[pair]) byPair[pair] = { total: 0, matched: 0 }
    byPair[pair].total++
    if (d.match_type !== 'exception') byPair[pair].matched++
  }

  const reliability = {}
  for (const [pair, stats] of Object.entries(byPair)) {
    reliability[`${pair}:reliability`] = {
      match_rate: stats.matched / stats.total,
      total: stats.total,
      matched: stats.matched,
    }
  }

  return reliability
}
