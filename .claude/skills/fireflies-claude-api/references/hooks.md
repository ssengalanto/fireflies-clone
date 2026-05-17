# Pattern: Client-Side Claude Hooks

The browser side of a Claude endpoint is a `fetch` wrapper plus (optionally) a `useSWR` hook around it. Two shapes: one for non-streaming JSON, one for streaming prose read via a `ReadableStream` reader.

For the surrounding `useSWR` conventions (`revalidateIfStale/OnFocus/OnReconnect: false`, `errorRetryCount: 1`, a `null` cache key as the readiness guard), see `fireflies-swr/references/hooks.md` — the "Expensive / immutable response" pattern is the right wrapper for both fetchers below.

## Non-streaming fetcher (structured output)

```ts
// lib/api/fetch<Task>.ts
import type { <ResultType> } from '@/lib/schemas/<resource>.schema'

export async function fetch<Task>(
  <inputField>: string,
  <optionalContext>?: string,
): Promise<<ResultType>> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: '<task-discriminator>',
      <inputField>,
      <optionalContext>,
    }),
  })

  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(error ?? '<default-error-message>')
  }

  const data = (await res.json()) as { result: string }
  return <parseResult>(data.result)
}
```

## Defensive structured parse

```ts
function <parseResult>(raw: string): <ResultType> {
  const clean = raw.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? (parsed as <ResultType>) : <safeDefault>
  } catch {
    return <safeDefault>
  }
}
```

## Streaming reader (long-form prose in a component)

```tsx
// components/<Streaming>.tsx
'use client'
import { useState } from 'react'

export function <Streaming><Task>({ <inputField> }: { <inputField>: string }) {
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setStreaming(true)
    setText('')
    setError(null)

    try {
      const res = await fetch('/api/claude/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ <inputField> }),
      })
      if (!res.ok || !res.body) throw new Error('<default-error-message>')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setText((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '<default-error-message>')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div>
      {/* trigger + rendered text + error surface */}
    </div>
  )
}
```

## What to adapt

- `<Task>` / `<task-discriminator>` — matches the route's `type` field exactly
- `<inputField>` / `<optionalContext>` — primary content + optional grounding, same names as the route body
- `<ResultType>` — for structured output, mirror the Zod schema's inferred type
- `<parseResult>` — the defensive parser; return shape matches `<ResultType>`
- `<safeDefault>` — `[]` for array outputs, a benign object/string for others
- `<default-error-message>` — user-facing fallback when the server doesn't return one

## What stays fixed

- All requests go to `/api/claude` or `/api/claude/*` — never `https://api.anthropic.com/...`
- `res.ok` is checked before reading the body; failures throw an `Error` with a usable message
- Structured responses are parsed via the defensive helper — never raw `JSON.parse` at the call site
- Streaming uses `res.body.getReader()` with a `TextDecoder({ stream: true })` — never `await res.text()`, which loses the streaming benefit
- Streaming UI clears prior text and toggles a `streaming` flag so the trigger button can disable itself

## Reach for this when

- **Non-streaming fetcher:** any structured Claude endpoint (action items, classifications, JSON extractions)
- **Streaming reader:** any long-form prose generation surfaced live to the user (summaries, narratives, follow-up drafts)
- **Wrapping in `useSWR`:** when the result should be cached (all `revalidate*` flags off) and only regenerated on an explicit user action — see `fireflies-swr`
