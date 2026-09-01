/**
 * Server-Sent Events endpoint for real-time reconciliation progress.
 * Client connects with ?batchId=xxx and receives live updates.
 */

// In-memory progress store (per server instance)
const progressStore = new Map()

export function updateProgress(batchId, data) {
  progressStore.set(batchId, {
    ...data,
    timestamp: Date.now(),
  })
}

export function clearProgress(batchId) {
  progressStore.delete(batchId)
}

export async function GET(request) {
  const batchId = new URL(request.url).searchParams.get('batchId')
  if (!batchId) {
    return new Response('batchId required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initial = progressStore.get(batchId) || { phase: 'waiting', progress: 0 }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`))

      // Poll for updates every 500ms
      const interval = setInterval(() => {
        try {
          const data = progressStore.get(batchId)
          if (data) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
            
            // Close stream if completed or failed
            if (data.phase === 'completed' || data.phase === 'failed') {
              clearInterval(interval)
              progressStore.delete(batchId)
              controller.close()
            }
          }
        } catch (err) {
          clearInterval(interval)
          controller.close()
        }
      }, 500)

      // Cleanup on disconnect
      request.signal?.addEventListener('abort', () => {
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
