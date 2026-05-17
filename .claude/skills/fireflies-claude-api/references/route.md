# Pattern: Next.js API Route for Claude

Every Claude call goes through a route handler. The handler is the trust boundary: it owns the SDK import, the API key, request validation, and the response envelope. Two shapes — one for structured JSON, one for streaming prose.

## Non-streaming (structured output)

```ts
// app/api/claude/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { build<TaskA>Prompt, build<TaskB>Prompt } from '@/lib/api/prompts'

const MODEL = '<claude-opus-4-7>'
const MAX_TOKENS = <MAX_OUTPUT_TOKENS>

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Body = {
  type: '<task-a>' | '<task-b>'
  <inputField>: string
  <optionalContext>?: string
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body
  const { type, <inputField>, <optionalContext> } = body

  if (!<inputField> || <inputField>.length < <MIN_INPUT_LENGTH>) {
    return NextResponse.json({ error: '<short-input-error>' }, { status: 400 })
  }

  const prompt =
    type === '<task-a>'
      ? build<TaskA>Prompt(<inputField>, <optionalContext>)
      : build<TaskB>Prompt(<inputField>)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    return NextResponse.json({ error: '<unexpected-response-error>' }, { status: 500 })
  }

  return NextResponse.json({ result: block.text })
}
```

## Streaming (long-form prose)

```ts
// app/api/claude/stream/route.ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { build<TaskA>Prompt } from '@/lib/api/prompts'

const MODEL = '<claude-opus-4-7>'
const MAX_TOKENS = <MAX_OUTPUT_TOKENS>

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { <inputField>, <optionalContext> } = await req.json()

  if (!<inputField> || <inputField>.length < <MIN_INPUT_LENGTH>) {
    return new Response('<short-input-error>', { status: 400 })
  }

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'user', content: build<TaskA>Prompt(<inputField>, <optionalContext>) },
    ],
  })

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
```

## What to adapt

- `<TaskA>` / `<TaskB>` — task identifiers (e.g. `Summary`, `ActionItems`); the `type` discriminator uses the lower-kebab form
- `<inputField>` — the primary user content (`transcript`, `document`, `query`)
- `<optionalContext>` — optional structured context the prompt may use (`title`, `participants`, `priorMessages`)
- `<MIN_INPUT_LENGTH>` — minimum tokens worth attempting (10 is a reasonable floor)
- `<MAX_OUTPUT_TOKENS>` — set per task; summaries `1024`, long extracts higher, classifications lower
- `<claude-opus-4-7>` — default. Swap to `claude-sonnet-4-6` for high-volume work or `claude-haiku-4-5-20251001` for cheap classification

## What stays fixed

- `import Anthropic from '@anthropic-ai/sdk'` only ever appears inside `app/api/claude/**/route.ts`
- `process.env.ANTHROPIC_API_KEY` is read directly in the handler — never passed in from a config module
- `MODEL` is a single top-of-file constant; never inline the model string into the `messages.create` call across multiple routes
- The response envelope is `{ result: string }` on success and `{ error: string }` with non-2xx on failure
- Streaming routes return raw text bytes with `Content-Type: text/plain` — never JSON-wrap chunks
- Length validation runs before the SDK call so empty/short inputs don't burn tokens

## Reach for this when

- Adding a new Claude-backed endpoint — copy the non-streaming shape and add a new `type` discriminator
- Adding a new long-form generation that the user waits on — copy the streaming shape into a new `app/api/claude/<task>/route.ts`
- Migrating model versions — change the `MODEL` constant in one place per route file
