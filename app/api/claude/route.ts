import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

import { parseActionItems } from '@/lib/fetchers/claude.fetcher'
import { claudeRequestSchema } from '@/lib/schemas/claude.schema'
import {
  MODEL,
  buildActionItemsPrompt,
  buildSummaryPrompt,
} from '@/lib/server/prompts'

// This is the ONLY file in the repo allowed to import `@anthropic-ai/sdk`
// or to touch `ANTHROPIC_API_KEY`. The variable is read directly from
// `process.env` (no proxy module) so Next.js's compile-time inlining of
// `NEXT_PUBLIC_*` can never accidentally bake it into the client bundle.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = claudeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    )
  }

  const { type, meetingId, transcript } = parsed.data

  if (type === 'summary') {
    return handleSummary(meetingId, transcript)
  }
  return handleActionItems(meetingId, transcript)
}

async function handleActionItems(
  meetingId: string,
  transcript: string,
): Promise<Response> {
  const startedAt = Date.now()

  let message: unknown
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildActionItemsPrompt(),
      messages: [{ role: 'user', content: transcript }],
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[claude.route] action-items SDK error:', err)
    return NextResponse.json(
      { error: 'Failed to extract action items' },
      { status: 500 },
    )
  }

  const text = extractText(message)
  const items = parseActionItems(text)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // Signal the client that the model produced output but we couldn't extract
  // any usable items from it. An empty array with no text is a legitimate
  // "no action items" — only set the header on a fallback to keep telemetry
  // honest.
  if (items.length === 0 && text.trim().length > 0 && !looksLikeEmptyJsonArray(text)) {
    headers['X-Parse-Fallback'] = 'empty-list'
  }

  // eslint-disable-next-line no-console
  console.log(
    `[claude.route] action-items complete in ${Date.now() - startedAt}ms (meeting=${meetingId}, items=${items.length})`,
  )

  return new Response(JSON.stringify(items), { status: 200, headers })
}

function extractText(message: unknown): string {
  if (typeof message !== 'object' || message === null) return ''
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return ''
  return content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        typeof block === 'object' &&
        block !== null &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string',
    )
    .map((b) => b.text)
    .join('')
}

function looksLikeEmptyJsonArray(text: string): boolean {
  return text.replace(/```json|```/g, '').trim() === '[]'
}

function handleSummary(meetingId: string, transcript: string): Response {
  const startedAt = Date.now()

  let sdkStream: AsyncIterable<unknown>
  try {
    sdkStream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: buildSummaryPrompt(),
      messages: [{ role: 'user', content: transcript }],
    }) as AsyncIterable<unknown>
  } catch (err) {
    // Synchronous SDK throw (auth misconfig, etc).
    // eslint-disable-next-line no-console
    console.error('[claude.route] synchronous SDK error:', err)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let firstChunkLogged = false
      try {
        for await (const event of sdkStream) {
          if (isTextDelta(event)) {
            if (!firstChunkLogged) {
              firstChunkLogged = true
              // eslint-disable-next-line no-console
              console.log(
                `[claude.route] summary first-chunk in ${Date.now() - startedAt}ms (meeting=${meetingId})`,
              )
            }
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        // eslint-disable-next-line no-console
        console.log(
          `[claude.route] summary complete in ${Date.now() - startedAt}ms (meeting=${meetingId})`,
        )
        controller.close()
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[claude.route] mid-stream error:', err)
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Meeting-Id': meetingId,
    },
  })
}

interface TextDeltaEvent {
  type: 'content_block_delta'
  delta: { type: 'text_delta'; text: string }
}

function isTextDelta(event: unknown): event is TextDeltaEvent {
  if (typeof event !== 'object' || event === null) return false
  const e = event as { type?: unknown; delta?: { type?: unknown; text?: unknown } }
  return (
    e.type === 'content_block_delta' &&
    !!e.delta &&
    e.delta.type === 'text_delta' &&
    typeof e.delta.text === 'string'
  )
}
