# API Contract: Claude Proxy

`app/api/claude/route.ts` is the **only** file in the repo allowed to import `@anthropic-ai/sdk`. It reads `process.env.ANTHROPIC_API_KEY` directly, never proxies the key through another module, and never exposes any header or payload that could leak it.

Two operations share a single endpoint, discriminated by the `type` field of the request body:

| `type` | Response shape | Streaming? |
|---|---|---|
| `'summary'` | `ReadableStream<Uint8Array>` of UTF-8 prose | Yes |
| `'action-items'` | `application/json` — `ActionItem[]` (possibly empty) | No |

Single endpoint because the two AI features share most of the validation, key handling, and error envelopes; only the prompt and the response shape differ.

The model is pinned at `claude-opus-4-7` via the `MODEL` constant in `lib/server/prompts.ts`. Changing models is a one-line change at that constant.

---

## `POST /api/claude` — Summary mode (streaming)

### Request body

```json
{ "type": "summary", "meetingId": "mtg_<uuid>", "transcript": "Alice: Hi everyone..." }
```

- `type` must equal `'summary'` exactly.
- `meetingId` is required so the response headers can echo it (used by the client to bind the stream to the right cache entry).
- `transcript` is required and must be at least 50 characters (anything shorter is not worth a generation).

### Response 200

- `Content-Type: text/plain; charset=utf-8`
- `Transfer-Encoding: chunked`
- `X-Meeting-Id: mtg_<uuid>` (echoes the request's `meetingId`)
- Body: a `ReadableStream<Uint8Array>` produced by `client.messages.stream({ model: MODEL, system: buildSummaryPrompt(), messages: [{ role: 'user', content: transcript }] })`. Chunks are flushed as they arrive.

The browser-side fetcher reads chunks with `res.body.getReader()` and decodes with `new TextDecoder('utf-8', { stream: true })`. The final concatenated string is what SWR caches under `meetingKeys.summary(meetingId)`.

### Response 400

```json
{ "error": "Transcript too short" }
```

- Returned when `transcript.length < 50`, `transcript` is missing, or `meetingId` is missing/malformed.
- Returned synchronously **before** any call to Anthropic — an empty prompt still costs tokens.

### Response 500

```json
{ "error": "Failed to generate summary" }
```

- Returned when the Anthropic SDK call rejects synchronously (auth failure, network) or when the stream errors mid-flight.
- Mid-stream errors: the route closes the stream and additionally writes a final terminator chunk if possible; the client's fetcher catches the read error and surfaces a recoverable error state per FR-023.

### Acceptance tests

- Valid request: response has `Content-Type: text/plain`, `X-Meeting-Id` echoes the request, and the body streams non-empty UTF-8 chunks.
- `type: 'summary'` with `transcript: ''` → `400` with the "too short" error.
- Mid-stream Anthropic failure → client reads at least the chunks before the failure, then surfaces an error; the SWR cache is left in its prior state (no partial write).
- The route handler module is the **only** place where `import Anthropic from '@anthropic-ai/sdk'` appears in the repo (verified by a static lint/grep gate in CI).

---

## `POST /api/claude` — Action items mode (non-streaming)

### Request body

```json
{ "type": "action-items", "meetingId": "mtg_<uuid>", "transcript": "Alice: ..." }
```

Same constraints as summary mode on the transcript length and meetingId presence.

### Response 200

```json
[
  { "id": "ai_1", "text": "Follow up with Bob by Friday", "owner": "alice@x.com", "dueDate": "2026-05-22T00:00:00.000Z" },
  { "id": "ai_2", "text": "Send the deck to the design team",   "owner": null,           "dueDate": null }
]
```

- Always returns a JSON array of `ActionItem` objects (possibly empty).
- The server runs `client.messages.create({...})` (non-streaming), then runs the same defensive parser the client could run (markdown-fence strip + `try/catch` + default to `[]`) so the wire-level response is **always** valid JSON. This is the difference from a naive proxy: the malformed-model-output handling lives server-side too, so the client's fetcher does not need to re-implement it.
- If the model returns valid items but without an `id`, the server synthesises `ai_<n>` ids.
- Cache key: `meetingKeys.actionItems(meetingId)`.

### Response 400 / 500

Same shape and rules as summary mode.

### Acceptance tests

- Valid request returns a JSON array (may be empty).
- A simulated model response that wraps the JSON in markdown fences still parses to a valid `ActionItem[]` (the fence-strip works server-side).
- A simulated model response that is completely unparseable returns `200` with `[]` and a non-blocking notice header `X-Parse-Fallback: empty-list` (used by the client to surface a notice toast).
- `type: 'action-items'` with `transcript: ''` → `400`.

---

## Why the server runs the defensive parser too

`fireflies-claude-api/references/hooks.md` documents a defensive parser on the client. v1 also runs it on the server, for two reasons:

1. **Wire-level guarantee**: the contract says "this endpoint returns a JSON array". Having the server fall back to `[]` keeps the wire-level contract honest even when the model misbehaves. Clients in any future language (mobile, CLI, etc.) get the same guarantee without re-implementing the recovery.
2. **Server-side telemetry**: the `X-Parse-Fallback` response header lets us count how often this happens without parsing logs. The client cannot give us that signal.

The client still re-validates against the zod `actionItemSchema` defensively. Two-step validation is cheap.

---

## Key-handling invariants (verified in CI)

These are gates, not aspirations:

1. `grep -r "@anthropic-ai/sdk" --include='*.{ts,tsx}'` returns at most one file: `app/api/claude/route.ts`.
2. No `NEXT_PUBLIC_*` env var contains the substring `ANTHROPIC`.
3. The route handler reads `process.env.ANTHROPIC_API_KEY` directly via `process.env`, not via any abstraction module (so the value never crosses a module boundary that could accidentally inline it elsewhere).
4. The route never echoes the key in any response, response header, or error message.

These four checks form the test in `__tests__/security/api-key-isolation.test.ts` and are blocking for merge.
