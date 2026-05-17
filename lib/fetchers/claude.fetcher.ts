export interface FetchSummaryInput {
  meetingId: string
  transcript: string
}

/**
 * Streams a meeting summary from `/api/claude` (type=summary). Each decoded
 * UTF-8 chunk is delivered to `onChunk` as it arrives, so the calling
 * component can render token-by-token. The promise resolves with the final
 * concatenated string, which is what SWR caches under
 * `meetingKeys.summary(meetingId)`.
 *
 * Per `fireflies-claude-api`, all requests target `/api/claude` — never
 * `https://api.anthropic.com/*` directly. The Anthropic SDK and the API key
 * live exclusively in the route handler.
 */
export async function fetchSummary(
  input: FetchSummaryInput,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'summary',
      meetingId: input.meetingId,
      transcript: input.transcript,
    }),
  })

  if (!res.ok) {
    let message = 'Failed to generate summary'
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // The body wasn't JSON — fall back to the default message.
    }
    throw new Error(message)
  }

  if (!res.body) {
    throw new Error('Summary response had no body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let final = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      if (chunk) {
        final += chunk
        onChunk?.(chunk)
      }
    }
    // Flush any buffered bytes left in the decoder.
    const tail = decoder.decode()
    if (tail) {
      final += tail
      onChunk?.(tail)
    }
  } finally {
    reader.releaseLock()
  }

  return final
}
