---
name: fireflies-claude-api
version: 1.0.0
description: Claude API integration for the Fireflies clone — Next.js API route proxy, streaming, prompt templates, useSummary and useActionItems hooks. Apply when touching app/api/claude/, fetchSummary, fetchActionItems, or any Anthropic SDK usage.
---

**Persona:** You are a security-conscious API integrator. The Anthropic SDK and the API key live exclusively on the server — never in the browser. You treat every Claude response as untrusted text that must be validated before it reaches application code, and you cache expensive generations aggressively because regenerating them costs real money.

## Mental Model

The Anthropic SDK NEVER leaves the server. The `@anthropic-ai/sdk` import, the `ANTHROPIC_API_KEY` env var, and the `messages.create` / `messages.stream` calls all live behind a Next.js route handler. The browser only ever talks to `/api/claude/*` — it has no knowledge that Anthropic exists. Why this boundary is non-negotiable: a leaked API key is both a security breach (anyone can impersonate your app) and a billing disaster (a scraped key gets drained in hours). Any `NEXT_PUBLIC_*` env var, any client-side `import Anthropic from '@anthropic-ai/sdk'`, any `fetch('https://api.anthropic.com/...')` from a component — all are bugs.

## Rules

1. **Always import the Anthropic SDK only inside `app/api/claude/**/route.ts` files.** Importing it from a client component or shared util ships the SDK to the browser and risks accidental key exposure.
2. **Always read `process.env.ANTHROPIC_API_KEY` directly inside the route handler; never proxy it through any other module.** The unprefixed name is what keeps Next.js from inlining it into the client bundle.
3. **Never use a `NEXT_PUBLIC_*` prefix for the Anthropic key.** Next.js inlines `NEXT_PUBLIC_*` into the client bundle at build time, permanently exposing the key.
4. **Always build prompts via functions exported from `lib/api/prompts.ts`; never inline prompt strings in the route handler.** Centralizing prompts lets you iterate, snapshot, and test them without touching routing or transport code.
5. **Always pin the model ID to a single exported constant.** Hardcoding model strings in multiple files makes version migrations and A/B comparisons error-prone.
6. **Always validate the request body and reject short/empty transcripts with a `400` before calling Claude.** An empty prompt still costs tokens and produces garbage; a 400 short-circuits cleanly.
7. **Always return errors in the shape `{ error: string }` with a non-2xx status code.** A consistent error envelope lets every client hook branch on `res.ok` and surface a single user-friendly message.
8. **Always wrap `JSON.parse` of Claude responses in `try/catch` and fall back to a safe default.** The model occasionally returns markdown fences or a preamble sentence even when instructed not to.
9. **Stream only when the user perceives latency (long-form generation).** Streaming structured JSON is meaningless — you can't parse a partial object — and adds complexity for no UX benefit.
10. **Cap retries at `1` for any hook that wraps a Claude endpoint.** Default retry-3 burns money and amplifies the wait when a prompt is genuinely failing.

## Streaming vs Non-Streaming

| Output shape | Endpoint | Why |
|---|---|---|
| Long-form prose (summaries, narratives) | `POST /api/claude/stream` | Token-by-token rendering hides latency |
| Structured JSON (action items, classifications) | `POST /api/claude` | Full response must arrive before parsing |
| Single short answer (yes/no, label) | `POST /api/claude` | Streaming overhead exceeds the response time |

## Model Selection

| Task | Model | Reason |
|---|---|---|
| Summary, action items, default AI features | `claude-opus-4-7` | Highest quality; the project defaults to the most capable model for user-facing AI output |
| High-volume batch or background jobs | `claude-sonnet-4-6` | Cheaper, faster, still strong reasoning |
| Cheap classification, routing, tagging | `claude-haiku-4-5-20251001` | Lowest latency and cost for short, structured outputs |

## Prompt Caching

| Use prompt caching when | Skip it when |
|---|---|
| Same long system prompt or transcript is reused across many requests | One-shot calls with unique inputs |
| Transcript is reused for both summary and action items in the same session | Inputs are small (a few hundred tokens) |
| You're paying for the same 5k+ token prefix on every request | Cache write cost would exceed savings |

## Common Mistakes

| Mistake | Why it breaks | Fix |
|---|---|---|
| Calling Anthropic directly from the browser | Exposes the API key in network tab and bundle | Always proxy through `/api/claude/*` |
| `NEXT_PUBLIC_ANTHROPIC_API_KEY` | Baked into client bundle at build time | Use `ANTHROPIC_API_KEY` (server-only) |
| Inline prompt strings in `route.ts` | Cannot snapshot, test, or iterate independently | Build prompts in `lib/api/prompts.ts` |
| `JSON.parse(data.result)` without try/catch | Throws on markdown fences or preambles | Strip fences, then parse inside `try/catch` with `[]` fallback |
| Streaming structured JSON | Partial JSON is unparseable | Stream prose only; use non-streaming for JSON |
| Default `revalidateOnFocus` on AI hooks | Re-triggers expensive generation on focus | Set `revalidateIfStale/OnFocus/OnReconnect: false` (see fireflies-swr) |
| Hardcoded model ID in multiple files | Migration touches every route and util | Single exported `MODEL` constant |
| Default retry (5) on Claude hooks | 5× the cost on a persistently failing prompt | `errorRetryCount: 1` |

## Patterns

- [`references/route.md`](./references/route.md) — Next.js API route handler shape for non-streaming and streaming endpoints
- [`references/prompts.md`](./references/prompts.md) — prompt-builder function shape and the structured-output contract
- [`references/hooks.md`](./references/hooks.md) — client-side `fetch` wrapper and streaming reader shape

## Cross-References

- → `fireflies-swr` — the AI-response hook pattern (`revalidateIfStale/OnFocus/OnReconnect: false`, `errorRetryCount: 1`, `null` key as readiness guard) wraps these endpoints; cache keys for AI results live there
- → `fireflies-tdd` — how to mock `fetch` for hook tests and stub the Anthropic SDK for route handler tests (never hit the real API)
- → `fireflies-zustand` — a "regenerate" UI affordance lives in `uiStore`; it calls SWR's `mutate(key)` to invalidate the cached AI result, never bypasses the cache directly
- → `fireflies-forms` — when a Claude call is triggered from a form (e.g. "Generate summary from pasted transcript"), validation lives in the form schema and the route still re-validates length
