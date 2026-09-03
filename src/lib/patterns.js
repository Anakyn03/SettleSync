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

  // Get all matched records for this run (exact + fee-adjusted + date-shifted)
  const { data: decisions } = await db
    .from('match_decisions')
    .select('*')
    .eq('run_id', runId)
    .in('match_type', ['exact', 'fee-adjusted', 'date-shifted'])

  if (!decisions?.length) {
    console.log('Patterns: No fee/lag matches to analyze')
    return patterns
  }

  // Group by source pair
  const byPair = {}
  for (const d of decisions) {
    const pair = d.feature_vector?.source_pair || 'unknown'
    if (!byPair[pair]) byPair[pair] = []
    byPair[pair].push(d)
  }

  // Learn fee patterns per source pair
  for (const [pair, matches] of Object.entries(byPair)) {
    if (matches.length < 2) continue // Need at least 2 samples

    const fees = matches
      .map(m => {
        const av = m.feature_vector
        if (!av?.amount_diff || !av?.amount_ratio || av.amount_ratio <= 0) return null
        // amount_diff / (max amount) = actual fee percentage
        // amount_ratio = min/max, so max = amount_diff / (1 - amount_ratio) when amounts differ
        const maxAmt = av.amount_ratio < 1 ? av.amount_diff / (1 - av.amount_ratio) : av.amount_diff
        const feePct = maxAmt > 0 ? av.amount_diff / maxAmt : 0
        return feePct > 0 && feePct < 0.1 ? feePct : null
      })
      .filter(f => f !== null)

    if (fees.length < 2) continue

    fees.sort((a, b) => a - b)
    const minFee = fees[0]
    const maxFee = fees[fees.length - 1]
    const avgFee = fees.reduce((s, f) => s + f, 0) / fees.length

    patterns.push({
      source: pair,
      pattern_type: 'fee',
      pattern_value: { min_fee: minFee, max_fee: maxFee, avg_fee: avgFee },
      sample_size: fees.length,
      confidence: Math.min(1, fees.length / 20), // More samples = more confidence
    })
  }

  // Learn lag patterns
  const { data: lagData } = await db
    .from('match_decisions')
    .select('*')
    .eq('run_id', runId)

  if (lagData?.length) {
    const lagByPair = {}
    for (const d of lagData) {
      const pair = d.feature_vector?.source_pair || 'unknown'
      const dateDiff = d.feature_vector?.date_diff || 0
      if (!lagByPair[pair]) lagByPair[pair] = []
      lagByPair[pair].push(dateDiff)
    }

    for (const [pair, lags] of Object.entries(lagByPair)) {
      if (lags.length < 2) continue
      const avgLag = lags.reduce((s, l) => s + l, 0) / lags.length
      const maxLag = Math.max(...lags)

      patterns.push({
        source: pair,
        pattern_type: 'lag',
        pattern_value: { avg_lag_days: avgLag, max_lag_days: maxLag },
        sample_size: lags.length,
        confidence: Math.min(1, lags.length / 20),
      })
    }
  }

  // Store patterns in database (check for existing to avoid duplicates)
  for (const p of patterns) {
    const { data: existing } = await db
      .from('source_patterns')
      .select('id')
      .eq('source', p.source)
      .eq('pattern_type', p.pattern_type)
      .limit(1)

    if (existing?.length) {
      // Update existing pattern
      await db
        .from('source_patterns')
        .update({
          pattern_value: p.pattern_value,
          sample_size: p.sample_size,
          confidence: p.confidence,
          last_updated: new Date().toISOString(),
        })
        .eq('id', existing[0].id)
    } else {
      // Insert new pattern
      const { error } = await db
        .from('source_patterns')
        .insert(p)
      if (error) {
        console.error(`Pattern storage failed for ${p.source}:${p.pattern_type}`, error)
      }
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
