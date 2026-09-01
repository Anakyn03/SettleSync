import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { analyzeException } from '@/lib/grok'
import { calculateConfidence, extractFeatures } from '@/lib/confidence'
import { predict, trainModel, getModelInfo } from '@/lib/ml'
import { getPatterns, learnPatterns, computeSourcePairReliability } from '@/lib/patterns'
import { updateProgress, clearProgress } from '../progress/route'
import { tryMatch, matchScore } from '@/lib/matching'

// ML confidence thresholds
const ML_AUTO_MATCH = 0.80
const ML_AUTO_REJECT = 0.20

// ── Group matching ───────────────────────────────────────────────────

function evaluateGroup(records) {
  const result = []
  for (let i = 0; i < records.length; i++) {
    let bestReason = null, bestPartner = null, bestScore = -1
    for (let j = 0; j < records.length; j++) {
      if (i === j) continue
      const reason = tryMatch(records[i], records[j])
      if (reason) {
        const score = matchScore(reason)
        if (score > bestScore) { bestScore = score; bestReason = reason; bestPartner = records[j] }
      }
    }
    // Only emit match when i < j to avoid duplicate pairs (A→B and B→A)
    if (bestPartner && records[i].id < bestPartner.id) {
      result.push({ record: records[i], partner: bestPartner, reason: bestReason })
    }
  }
  return result
}

function groupBy(records, key) {
  const map = {}
  for (const r of records) { if (!map[r[key]]) map[r[key]] = []; map[r[key]].push(r) }
  return map
}

// ── Main reconciliation ──────────────────────────────────────────────

export async function POST(request) {
  try {
    const { batchId } = await request.json()
    if (!batchId) return NextResponse.json({ error: 'batchId is required' }, { status: 400 })

    const db = getSupabase()
    updateProgress(batchId, { phase: 'init', progress: 0, message: 'Loading records...' })

    // Create/get run record
    const { data: existingRun } = await db
      .from('reconciliation_runs')
      .select('*')
      .eq('batch_id', batchId)
      .single()

    let runId = existingRun?.id
    if (!existingRun) {
      const { data: newRun } = await db
        .from('reconciliation_runs')
        .insert({ batch_id: batchId, status: 'processing', started_at: new Date().toISOString() })
        .select('id')
        .single()
      runId = newRun.id
    } else {
      await db.from('reconciliation_runs')
        .update({ status: 'processing', started_at: new Date().toISOString(), matched_count: 0, exception_count: 0 })
        .eq('id', runId)
    }

    // Fetch all records
    const { data: allRecords, error: fetchError } = await db
      .from('settlements')
      .select('*')
      .eq('batch_id', batchId)
      .order('id')

    if (fetchError) throw new Error(fetchError.message)
    if (!allRecords?.length) throw new Error('No records found for this batch')

    const total = allRecords.length

    // Reset statuses
    for (const r of allRecords) {
      r.status = 'unmatched'
      r.matched_with = null
      r.match_reason = null
      r.confidence = 0
    }

    // Load learned patterns
    updateProgress(batchId, { phase: 'patterns', progress: 5, message: 'Loading learned patterns...' })
    const patterns = await getPatterns()
    const pairReliability = await computeSourcePairReliability()
    const allPatterns = { ...patterns, ...pairReliability }

    // Load ML training data and train model
    updateProgress(batchId, { phase: 'ml', progress: 10, message: 'Training ML classifier...' })
    const { data: trainingData } = await db
      .from('learning_data')
      .select('feature_vector, label')

    if (trainingData?.length >= 5) {
      trainModel(trainingData.map(d => ({ features: d.feature_vector, label: d.label })))
    }

    // ── Pass 1: Deterministic matching ──
    updateProgress(batchId, { phase: 'pass1', progress: 15, message: 'Running deterministic matching...' })
    
    const groups = groupBy(allRecords, 'txn_id')
    const pass1Decisions = []
    let processed = 0

    for (const group of Object.values(groups)) {
      if (group.length < 2) continue
      const matches = evaluateGroup(group)

      for (const { record, partner, reason } of matches) {
        const features = extractFeatures(record, partner)
        const confidence = calculateConfidence(record, partner, allPatterns)

        record.status = 'matched'
        record.match_reason = reason
        record.confidence = confidence
        partner.status = 'matched'
        partner.match_reason = reason
        partner.confidence = confidence

        pass1Decisions.push({
          run_id: runId,
          record_a_id: record.id,
          record_b_id: partner.id,
          match_type: reason,
          confidence: confidence,
          reasoning: reason,
          feature_vector: features,
        })
      }

      processed += group.length
      const progress = 15 + Math.round((processed / total) * 40)
      updateProgress(batchId, { 
        phase: 'pass1', 
        progress, 
        message: `Deterministic matching: ${processed}/${total} records`,
        matched: allRecords.filter(r => r.status === 'matched').length
      })
    }

    // Store Pass 1 decisions
    if (pass1Decisions.length) {
      await db.from('match_decisions').insert(pass1Decisions)
    }

    // ── Pass 2: ML + Grok for unmatched ──
    updateProgress(batchId, { phase: 'pass2', progress: 55, message: 'Running ML classification...' })

    const unmatched = allRecords.filter(r => r.status === 'unmatched')
    const pass2Decisions = []
    let mlMatched = 0, grokMatched = 0, grokExceptions = 0

    if (unmatched.length > 0) {
      const allByTxnId = groupBy(allRecords, 'txn_id')

      for (const record of unmatched) {
        const peers = (allByTxnId[record.txn_id] || []).filter(
          r => r.id !== record.id && r.source !== record.source
        )
        if (!peers.length) continue

        // Pick best peer (closest amount)
        const bestPeer = peers.reduce((best, p) => {
          const dBest = Math.abs(Number(best.amount) - Number(record.amount))
          const dCurr = Math.abs(Number(p.amount) - Number(record.amount))
          return dCurr < dBest ? p : best
        })

        const features = extractFeatures(record, bestPeer)

        // ML prediction
        const mlResult = predict(features)

        if (mlResult.probability >= ML_AUTO_MATCH) {
          // ML is confident it's a match
          const confidence = calculateConfidence(record, bestPeer, allPatterns)
          record.status = 'matched'
          record.match_reason = `ML match (${(mlResult.probability * 100).toFixed(0)}% confidence)`
          record.confidence = confidence
          mlMatched++

          pass2Decisions.push({
            run_id: runId, record_a_id: record.id, record_b_id: bestPeer.id,
            match_type: 'ml-match', confidence: confidence,
            reasoning: `ML auto-match: ${(mlResult.probability * 100).toFixed(0)}% probability`,
            feature_vector: features
          })
        } else if (mlResult.probability <= ML_AUTO_REJECT) {
          record.status = 'exception'
          record.match_reason = `ML exception (${((1 - mlResult.probability) * 100).toFixed(0)}% confidence)`
          record.confidence = 1 - mlResult.probability

          pass2Decisions.push({
            run_id: runId, record_a_id: record.id, record_b_id: bestPeer.id,
            match_type: 'exception', confidence: 1 - mlResult.probability,
            reasoning: `ML auto-reject: ${(mlResult.probability * 100).toFixed(0)}% probability`,
            feature_vector: features,
          })
        } else {
          const analysis = await analyzeException(record, bestPeer)
          const confidence = calculateConfidence(record, bestPeer, allPatterns)

          if (analysis.isMatch) {
            record.status = 'matched'
            record.match_reason = `[Grok] ${analysis.reason}`
            record.confidence = confidence
            grokMatched++
          } else {
            record.status = 'exception'
            record.match_reason = `[Grok] ${analysis.reason}`
            record.confidence = confidence
            grokExceptions++
          }

          pass2Decisions.push({
            run_id: runId, record_a_id: record.id, record_b_id: bestPeer.id,
            match_type: analysis.isMatch ? 'grok-match' : 'exception',
            confidence: confidence,
            reasoning: analysis.reason,
            feature_vector: features,
          })
        }
      }
    }

    if (pass2Decisions.length) {
      await db.from('match_decisions').insert(pass2Decisions)
    }

    const allDecisions = [...pass1Decisions, ...pass2Decisions]
    if (allDecisions.length) {
      const learningRows = allDecisions.map(d => ({
        feature_vector: d.feature_vector,
        label: d.match_type !== 'exception',
        confidence: d.confidence,
        source_pair: d.feature_vector?.source_pair,
        run_id: runId,
      }))
      await db.from('learning_data').insert(learningRows)
    }

    updateProgress(batchId, { phase: 'finalize', progress: 90, message: 'Finalizing...' })

    // Write all statuses back to database
    for (const r of allRecords) {
      const { error: updErr } = await db.from('settlements')
        .update({
          status: r.status,
          match_reason: r.match_reason || (r.status === 'exception' ? 'No matching transaction found' : null),
        })
        .eq('id', r.id)
      if (updErr) console.error(`Failed to update record ${r.id}:`, updErr.message)
    }

    // Safety: mark any still-unmatched as exceptions
    await db.from('settlements')
      .update({ status: 'exception', match_reason: 'No matching transaction found in other sources' })
      .eq('batch_id', batchId)
      .eq('status', 'unmatched')

    const matched = allRecords.filter(r => r.status === 'matched').length
    const exceptions = total - matched
    const matchRate = total ? Math.round((matched / total) * 10000) / 100 : 0

    await db.from('reconciliation_runs')
      .update({
        status: 'completed',
        matched_count: matched,
        exception_count: exceptions,
        match_rate: matchRate,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    updateProgress(batchId, { phase: 'learning', progress: 95, message: 'Learning patterns...' })
    try { await learnPatterns(runId) } catch (e) { console.error('Pattern learning failed:', e.message) }

    updateProgress(batchId, { 
      phase: 'completed', progress: 100, message: 'Reconciliation complete',
      stats: { total, matched, exceptions, matchRate }
    })

    setTimeout(() => clearProgress(batchId), 5000)

    return NextResponse.json({
      success: true, batchId, runId,
      stats: { total, matched, exceptions, matchRate },
      pass1: { deterministic: pass1Decisions.length },
      pass2: { mlMatched, grokMatched, grokExceptions },
      ml: getModelInfo(),
    })
  } catch (err) {
    console.error('Reconciliation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
