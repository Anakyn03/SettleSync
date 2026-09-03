/**
 * Shared matching primitives used by reconcile, confidence, and ML.
 * Single source of truth for thresholds and matching logic.
 */

export const FEE_THRESHOLD = 0.03    // 3% max fee difference
export const AMOUNT_TOLERANCE = 0.50 // ₹0.50 absolute tolerance
export const DATE_TOLERANCE = 7      // max 7 days apart

export function daysBetween(d1, d2) {
  return Math.round(Math.abs((new Date(d1) - new Date(d2)) / 86400000))
}

/**
 * Try to match two records. Returns match reason or null.
 * Only matches across different sources with the same txn_id.
 */
export function tryMatch(a, b) {
  if (a.source === b.source || a.txn_id !== b.txn_id) return null

  const amtA = Number(a.amount), amtB = Number(b.amount)
  const dayDiff = daysBetween(a.txn_date, b.txn_date)

  // Exact match: same amount (within tolerance) and same date
  if (Math.abs(amtA - amtB) <= AMOUNT_TOLERANCE && dayDiff === 0) return 'exact'

  // Date too far for any match
  if (dayDiff > DATE_TOLERANCE) return null

  const base = Math.max(amtA, amtB)
  const pctDiff = base > 0 ? Math.abs(amtA - amtB) / base : 0

  // Fee-adjusted: small percentage difference (e.g., payment gateway fees)
  if (pctDiff > 0 && pctDiff <= FEE_THRESHOLD) return 'fee-adjusted'

  // Date-shifted: same amount, different date
  if (Math.abs(amtA - amtB) <= AMOUNT_TOLERANCE) return 'date-shifted'

  return null
}

export function matchScore(reason) {
  return reason === 'exact' ? 3 : reason === 'fee-adjusted' ? 2 : 1
}
