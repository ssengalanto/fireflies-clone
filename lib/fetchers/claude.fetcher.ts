import {
  actionItemSchema,
  type ActionItem,
} from '@/lib/schemas/meeting.schema'

export interface FetchSummaryInput {
  meetingId: string
  transcript: string
}

export interface FetchActionItemsInput {
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

/**
 * Defensive parser for action-item responses. The model occasionally wraps
 * its JSON output in markdown fences or returns something unparseable; the
 * contract demands we degrade to `[]` rather than crash (FR-010, FR-011).
 *
 * Steps:
 * 1. Strip ```` ```json ```` and ```` ``` ```` fences.
 * 2. `JSON.parse` inside a try/catch — return [] on failure.
 * 3. Confirm the parsed value is an array — return [] if not.
 * 4. Validate each item with `actionItemSchema` — drop the failures.
 * 5. Synthesise `ai_<n>` ids for any items that arrived without one.
 *
 * Exported so the server route handler can run the same pass before it
 * lands the wire-level response on the client.
 */
export function parseActionItems(raw: string): ActionItem[] {
  const clean = raw.replace(/```json|```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: ActionItem[] = []
  for (const [index, candidate] of parsed.entries()) {
    if (typeof candidate !== 'object' || candidate === null) continue
    const withId = {
      // Synthesise an id when the model didn't supply one. The route
      // handler does the same — duplicated cheaply so each layer's contract
      // is self-sufficient.
      id: (candidate as { id?: unknown }).id ?? `ai_${index + 1}`,
      ...(candidate as Record<string, unknown>),
    }
    const result = actionItemSchema.safeParse(withId)
    if (result.success) out.push(result.data)
  }
  return out
}

/**
 * Extracts structured action items from `/api/claude` (type=action-items).
 * The route returns a JSON array; this fetcher re-validates each item via
 * `actionItemSchema` so a misbehaving server can never push malformed data
 * into the client cache.
 */
export async function fetchActionItems(
  input: FetchActionItemsInput,
): Promise<ActionItem[]> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'action-items',
      meetingId: input.meetingId,
      transcript: input.transcript,
    }),
  })

  if (!res.ok) {
    let message = 'Failed to extract action items'
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // body wasn't JSON — fall back to the default message
    }
    throw new Error(message)
  }

  let parsed: unknown
  try {
    parsed = await res.json()
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: ActionItem[] = []
  for (const [index, candidate] of parsed.entries()) {
    if (typeof candidate !== 'object' || candidate === null) continue
    const withId = {
      id: (candidate as { id?: unknown }).id ?? `ai_${index + 1}`,
      ...(candidate as Record<string, unknown>),
    }
    const result = actionItemSchema.safeParse(withId)
    if (result.success) out.push(result.data)
  }
  return out
}
