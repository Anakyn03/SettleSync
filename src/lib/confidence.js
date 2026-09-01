import { AMOUNT_TOLERANCE, FEE_THRESHOLD, DATE_TOLERANCE, daysBetween } from './matching'

/**
 * Calculate confidence score (0–1) for a match between two records.
 * Factors: amount proximity (40pts), date proximity (25pts),
 * fee pattern consistency (20pts), source pair reliability (15pts).
 */
export function calculateConfidence(a, b, patterns = {}) {
  const amtA = Number(a.amount)
  const amtB = Number(b.amount)
  const dayDiff = daysBetween(a.txn_date, b.txn_date)
  const amountDiff = Math.abs(amtA - amtB)
  const amountPctDiff = Math.max(amtA, amtB) > 0 ? amountDiff / Math.max(amtA, amtB) : 0
  const sourcePair = [a.source, b.source].sort().join('-')

  let score = 0

  // Amount proximity (0–40)
  if (amountDiff <= AMOUNT_TOLERANCE) {
    score += 40
  } else if (amountPctDiff <= FEE_THRESHOLD) {
    score += Math.round(40 * (1 - amountPctDiff / FEE_THRESHOLD))
  } else {
    score += Math.max(0, 40 - Math.min(40, Math.round(amountPctDiff * 100)))
  }

  // Date proximity (0–25)
  if (dayDiff === 0) {
    score += 25
  } else if (dayDiff <= DATE_TOLERANCE) {
    score += Math.round(25 * (1 - dayDiff / (DATE_TOLERANCE + 1)))
  }

  // Fee pattern consistency (0–20)
  const feePattern = patterns[`${sourcePair}:fee`]
  if (feePattern && amountPctDiff > 0) {
    const { min_fee, max_fee, avg_fee } = feePattern
    if (amountPctDiff >= min_fee && amountPctDiff <= max_fee) {
      score += Math.round(20 * (1 - Math.abs(amountPctDiff - avg_fee) / (max_fee - min_fee || 0.01)))
    } else {
      score += 5
    }
  } else {
    score += 10
  }

  // Source pair reliability (0–15)
  const pairReliability = patterns[`${sourcePair}:reliability`]
  score += pairReliability ? Math.round(15 * pairReliability.match_rate) : 8

  return Math.min(1, Math.max(0, score / 100))
}

/**
 * Extract features for ML training from a record pair.
 */
export function extractFeatures(a, b) {
  const amtA = Number(a.amount)
  const amtB = Number(b.amount)
  const dayDiff = daysBetween(a.txn_date, b.txn_date)
  const amountDiff = Math.abs(amtA - amtB)
  const amountRatio = Math.max(amtA, amtB) > 0 ? Math.min(amtA, amtB) / Math.max(amtA, amtB) : 0

  return {
    amount_ratio: amountRatio,
    amount_diff: amountDiff,
    date_diff: dayDiff,
    source_pair: [a.source, b.source].sort().join('-'),
    txn_id_match: a.txn_id === b.txn_id ? 1 : 0,
    same_amount: amountDiff <= AMOUNT_TOLERANCE ? 1 : 0,
    same_date: dayDiff === 0 ? 1 : 0,
    fee_range: amountRatio > 0.97 && amountRatio < 1 ? 1 : 0,
  }
}
