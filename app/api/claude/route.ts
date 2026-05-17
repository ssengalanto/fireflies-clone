import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

import { claudeRequestSchema } from '@/lib/schemas/claude.schema'
import { MODEL, buildSummaryPrompt } from '@/lib/server/prompts'

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

  // Action-items branch lands in US3 (T088).
  return NextResponse.json(
    { error: 'action-items endpoint not yet implemented' },
    { status: 501 },
  )
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
