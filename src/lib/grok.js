/**
 * AI-assisted transaction analysis via Grok (xAI).
 * Used for ambiguous pairs that ML classifier couldn't resolve.
 */

const GROK_URL = 'https://api.x.ai/v1/chat/completions'

const SYSTEM_PROMPT = `You are a financial reconciliation expert. You analyze pairs of transactions from different sources to determine if they represent the same real-world payment.

Rules:
1. Same txn_id strongly suggests same transaction
2. Fee deductions (typically 1-3%) explain amount differences
3. Settlement delays (1-2 business days) explain date differences
4. Partial refunds, chargebacks, and duplicates are possible
5. If amounts differ by >5% with no fee explanation, likely different transactions

Never use generic filler like 'likely a timing issue' or 'possible fee deduction' without stating the actual percentage or day count from the computed values provided.

Respond with ONLY a JSON object:
{"isMatch": true/false, "reason": "1-2 sentence explanation citing specific numbers", "confidence": "high/medium/low"}`

export async function analyzeException(recordA, recordB) {
  try {
    const amountA = Number(recordA.amount)
    const amountB = Number(recordB.amount)
    const diff = Math.abs(amountA - amountB)
    const diffPercent = ((diff / Math.max(amountA, amountB)) * 100).toFixed(2)
    const dayGap = Math.abs(
      (new Date(recordA.txn_date) - new Date(recordB.txn_date)) / (1000 * 60 * 60 * 24)
    )

    const prompt = `Transaction A — Source: ${recordA.source}, ID: ${recordA.txn_id}, Amount: ₹${recordA.amount}, Date: ${recordA.txn_date}\nTransaction B — Source: ${recordB.source}, ID: ${recordB.txn_id}, Amount: ₹${recordB.amount}, Date: ${recordB.txn_date}\n\nComputed amount difference: ₹${diff.toFixed(2)} (${diffPercent}%)\nComputed date gap: ${dayGap} day(s)\n\nAre these the same transaction? Explain your reasoning citing these specific numbers.`

    const res = await fetch(GROK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.5,
      }),
    })

    if (!res.ok) {
      throw new Error(`Grok API ${res.status}: ${res.statusText}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Parse JSON response
    const parsed = extractJson(content)
    if (parsed && typeof parsed.isMatch === 'boolean') {
      return {
        isMatch: parsed.isMatch,
        reason: parsed.reason || 'AI analysis',
        confidence: parsed.confidence || 'medium',
      }
    }

    // Heuristic fallback
    const lower = content.toLowerCase()
    return {
      isMatch: lower.includes('yes') && !lower.includes('not the same'),
      reason: content.slice(0, 300) || 'AI response parsed heuristically',
      confidence: 'low',
    }
  } catch (err) {
    console.error('Grok analysis failed:', err.message)
    return {
      isMatch: false,
      reason: 'AI review failed — needs manual check',
      confidence: 'none',
    }
  }
}

function extractJson(text) {
  const start = text.indexOf('{')
  if (start === -1) return null
  const end = text.lastIndexOf('}')
  if (end === -1) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}
