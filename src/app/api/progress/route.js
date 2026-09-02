/**
 * Server-Sent Events endpoint for real-time reconciliation progress.
 * Client connects with ?batchId=xxx and receives live updates.
 *
 * On Vercel serverless, in-memory stores don't work across function instances.
 * We use Supabase as the shared progress store.
 */

import { getSupabase } from '@/lib/supabase'

// Still export updateProgress/clearProgress for reconcile route compatibility
// These now write to Supabase instead of memory
export async function updateProgress(batchId, data) {
  try {
    const db = getSupabase()
    await db
      .from('reconciliation_runs')
      .update({
        phase: data.phase || 'waiting',
        progress: data.progress || 0,
        message: data.message || '',
      })
      .eq('batch_id', batchId)
  } catch (err) {
    // Silently fail — progress is non-critical
    console.error('Progress update failed:', err.message)
  }
}

export async function clearProgress(batchId) {
  // No-op — we just leave the final progress state
}

export async function GET(request) {
  const batchId = new URL(request.url).searchParams.get('batchId')
  if (!batchId) {
    return new Response('batchId required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false

      const send = (data) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      // Poll Supabase every 800ms for progress updates
      const poll = async () => {
        if (closed) return
        try {
          const db = getSupabase()
          const { data } = await db
            .from('reconciliation_runs')
            .select('phase, progress, message')
            .eq('batch_id', batchId)
            .single()

          if (data) {
            send(data)
            if (data.phase === 'completed' || data.phase === 'failed') {
              closed = true
              clearInterval(interval)
              controller.close()
              return
            }
          }
        } catch {
          // Run might not exist yet — send waiting state
          send({ phase: 'waiting', progress: 0, message: 'Starting...' })
        }
      }

      // Initial poll
      poll()

      const interval = setInterval(poll, 800)

      // Cleanup on disconnect
      request.signal?.addEventListener('abort', () => {
        closed = true
        clearInterval(interval)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
