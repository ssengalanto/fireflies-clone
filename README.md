# Fireflies Clone

A single-user, local-first meeting capture app. Record audio in the browser, get an automatic transcript from Whisper (with an editable review pass), then have Claude produce a streaming summary and a structured list of action items. Built TDD-first with Next.js 14, SWR, Zustand, react-hook-form, zod, Tailwind, and shadcn/ui.

The full specs, design plans, research logs, and task lists live under [`specs/001-fireflies-clone/`](specs/001-fireflies-clone/) (baseline) and [`specs/002-recording-transcription/`](specs/002-recording-transcription/) (automatic transcription, layered on top).

## Setup

Prerequisites:
- **Node.js 20+** (Next.js 14 minimum)
- **pnpm 10+**
- An **Anthropic API key** with access to `claude-opus-4-7` (server-only — never reaches the browser)
- An **OpenAI API key** with access to `whisper-1` for automatic transcription (server-only — never reaches the browser)

```bash
pnpm install
cp .env.example .env.local
# edit .env.local and fill in ANTHROPIC_API_KEY and OPENAI_API_KEY
pnpm dev    # http://localhost:3000
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Read once in `app/api/claude/route.ts`. **Never** prefix with `NEXT_PUBLIC_` — that would inline it into the client bundle at build time. |
| `OPENAI_API_KEY` | yes | Read once in `app/api/transcribe/route.ts` for `whisper-1` automatic transcription. **Never** prefix with `NEXT_PUBLIC_`. See [`specs/002-recording-transcription/contracts/transcribe.md`](specs/002-recording-transcription/contracts/transcribe.md) for the full wire contract. |
| `NEXT_PUBLIC_APP_NAME` | no | Cosmetic; defaults to `"Fireflies Clone"`. |
| `BASIC_AUTH_USER` | no | When set together with `BASIC_AUTH_PASSWORD`, gates the entire deployment (UI + every `/api/*` route) behind HTTP Basic Auth via `middleware.ts`. Intended for public Vercel URLs so the metered Anthropic / OpenAI routes can't be abused. Leave unset locally to disable. |
| `BASIC_AUTH_PASSWORD` | no | Pairs with `BASIC_AUTH_USER`. If either is empty/unset, the gate is a no-op. |

A static security test (`__tests__/security/api-key-isolation.test.ts`) asserts that:
1. `@anthropic-ai/sdk` is imported by exactly one file (the Claude route handler).
2. `openai` is imported by exactly one file (the transcribe route handler).
3. `process.env.ANTHROPIC_API_KEY` and `process.env.OPENAI_API_KEY` are read directly in their respective routes.
4. No `NEXT_PUBLIC_*ANTHROPIC*` or `NEXT_PUBLIC_*OPENAI*` variable exists in `.env.example`.

## Public deployment gate (HTTP Basic Auth)

A single `middleware.ts` at the project root sits in front of every request and, when both `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` are set, requires HTTP Basic Auth before anything (UI page or API route) is served. This exists so a public Vercel URL doesn't expose `/api/claude` and `/api/transcribe` — the two routes that spend real money — as an open faucet.

- **Opt-in by configuration.** If either env var is unset or empty, the middleware is a no-op. `pnpm dev` keeps working without setup; on Vercel you set both vars and the gate is always on.
- **Coverage.** The matcher gates everything except `_next/static`, `_next/image`, `favicon.ico`, and `robots.txt`. The stub `/api/auth/login` is **inside** the gate — it is not a way around it.
- **Mechanics.** On missing or wrong credentials, the middleware returns `401 WWW-Authenticate: Basic realm="Fireflies Clone", charset="UTF-8"`, which makes browsers prompt natively and lets `curl -u user:pass` work for API testing. Comparison is constant-time over UTF-8 char codes (the Edge runtime has no `node:crypto`/`Buffer`), and the decoded header is split on the **first** colon so passwords containing `:` are supported.
- **Enable on Vercel.** Project Settings → Environment Variables → add `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` (Production, and Preview if you want previews gated too) → redeploy.

This is a deployment access gate, not application-level auth. The in-app stub login at `/api/auth/login` is unchanged (see _Limitations / out of scope_).

## Scripts

```bash
pnpm dev              # dev server at http://localhost:3000
pnpm build            # production build
pnpm start            # serve the production build
pnpm typecheck        # tsc --noEmit
pnpm lint             # next lint (extends core-web-vitals + import/order)

pnpm test             # full Jest suite (--passWithNoTests)
pnpm test:watch       # TDD watch loop
pnpm test:coverage    # writes a coverage/ report; enforces thresholds on lib/
```

## Architecture map

```
lib/schemas/    zod schemas + inferred TS types — one file per domain (meeting, transcript, auth, claude)
lib/fetchers/   plain async network calls — NO react/swr/zustand imports here
lib/hooks/      ONLY files that import swr        — wrap fetchers + Zustand
lib/store/      ONLY files that import zustand   — UI/session state, never server data
lib/server/     server-side data store + prompts — used by API routes only
lib/providers/  SWRProvider, StoreProvider        — mounted at the root layout

app/api/        the wire-level API — `meetings/*`, `claude`, `transcribe`, `auth/login`
app/(auth)/     unauthenticated routes (login)
app/(dashboard) protected routes (dashboard, meeting detail); auth gate in layout

components/ui/         shadcn primitives only
components/meetings/   MeetingCard, MeetingList, MeetingFilters, NewMeetingModal
components/recording/  RecordingControls, RecordingTimer (MediaRecorder, component-local state)
components/transcript/ TranscriptView, TranscriptEditor, TranscriptionReview (auto orchestrator), TranscriptionFallback (failure UI)
components/summary/    SummaryView, ActionItems
components/auth/       LoginForm

__tests__/      mirrors the source tree; layer-ordered (schemas/, store/, fetchers/, hooks/, components/, api/, server/, security/, utils/)
```

The rule the file tree encodes: **if you're about to write `fetch(...)` inside a component or hook test, stop — it belongs in `lib/fetchers/`. If you're about to import `swr` outside `lib/hooks/`, stop — components consume hooks, never SWR directly. If you're about to import `@anthropic-ai/sdk` outside `app/api/claude/route.ts` or `openai` outside `app/api/transcribe/route.ts`, stop — there are no exceptions; the security test will fail the build.**

## Constitution (the four gates)

The conventions live in `.claude/skills/fireflies-*` and are exercised by the test suite. They're non-negotiable in this repo.

| Gate | Source | How it's enforced |
|---|---|---|
| **TDD, schema → store → fetcher → hook → component → route** | `fireflies-tdd` | Tests-first within every slice; `tasks.md` orders work by layer. |
| **SWR owns server state; Zustand owns UI state; never both** | `fireflies-swr` + `fireflies-zustand` | `data-model.md` partitions every entity; the cache-key factory routes invalidation. |
| **AI key server-only, one import site** | `fireflies-claude-api` | `__tests__/security/api-key-isolation.test.ts` greps the source tree and the `.env.example` on every test run. |
| **Forms: zod schema → zodResolver → useForm → useSWRMutation** | `fireflies-forms` | Every form has one hook in `lib/hooks/use<X>Form.ts`; components stay declarative. |

## Streaming summary end-to-end (the subtlest path)

1. User clicks **Generate summary** on a meeting detail page.
2. `useSummaryStream(meetingId, transcript).generate()` is invoked — the only entry point that fires a Claude call.
3. The browser fetcher posts to `/api/claude` (type=summary). The route validates, calls `client.messages.stream({...})`, and returns the resulting `ReadableStream` as the response body. Headers: `Content-Type: text/plain; charset=utf-8`, `X-Meeting-Id: <id>`.
4. The fetcher reads chunks via `res.body.getReader()`, decodes UTF-8 with the streaming flag, yields each chunk to its `onChunk` callback, and finally resolves with the concatenated string.
5. `useSummaryStream` accumulates chunks into a local `useState<string>` for the live render. When `fetchSummary` resolves, it writes the final string into the SWR cache under `meetingKeys.summary(meetingId)` via `mutate(key, final, { revalidate: false })`.
6. Re-opening the meeting page reads through `useSummary(meetingId)` — pure cache reader, immutable config (`revalidateIfStale/OnFocus/OnReconnect: false`), no second AI call.

## Automatic transcription end-to-end

1. User clicks **Stop** on `RecordingControls`. `useRecording` finalizes the `MediaRecorder` and exposes the captured `Blob` via its `audioBlob` field.
2. `RecordingControls` fires its `onAudioBlob(blob)` callback. The meeting detail page lifts the blob into its `pendingAudio` state and passes it to `<TranscriptionReview audioBlob={pendingAudio} />`.
3. `TranscriptionReview` watches the prop. On a `null → Blob` transition (with a `processedRef` guard so re-renders don't re-fire) it calls `useTranscribeRecording(meetingId).trigger(blob)`.
4. The fetcher (`lib/fetchers/transcribe.fetcher.ts`) enforces the 25 MB pre-flight cap, builds a `FormData`, and POSTs to `/api/transcribe`. The route reads `process.env.OPENAI_API_KEY` directly and forwards the audio to `client.audio.transcriptions.create({ model: 'whisper-1', response_format: 'verbose_json' })`.
5. The route classifies the result. Empty `text` → `422 No speech detected`. Every `verbose_json` segment with `no_speech_prob > 0.6` → `422 No speech detected` (catches Whisper's "Bye." / "Thanks for watching!" hallucinations on silent audio). Otherwise → `200 { transcript, durationSeconds }`.
6. On 200 the produced text becomes the `initialValue` of `<TranscriptEditor>`. The user reviews, edits, clicks **Save transcript**. `useUpdateTranscript` PATCHes the meeting via `/api/meetings/[id]`, the SWR cache updates, and the page transitions to the AI-output branch (summary + action items). The audio `Blob` is dropped from `useRecording` state via `clearAudio()` — never persisted client or server side.
7. On 4xx/5xx the hook surfaces a typed `TranscriptionError` (`NETWORK | TOO_LARGE | NO_SPEECH | PROVIDER`). `<TranscriptionFallback>` renders the right copy and three affordances (Retry hidden for `TOO_LARGE` / `NO_SPEECH`, since retrying with the same blob would fail the same way). **Enter manually** opens an empty `TranscriptEditor`; **Re-record** remounts `RecordingControls` (forced via a `key={recorderEpoch}` increment) so `useRecording` resets to `idle`.

## Data persistence

- **Meetings** live in a server-side in-memory `Map<string, Meeting>` (`lib/server/meetingStore.ts`), seeded once per cold start from `data/meetings.seed.json`. The map empties on server restart — acceptable for v1; swap for a JSON write, SQLite, or Vercel KV if v2 needs durability.
- **UI state** (filters, in-progress draft, auth session) is persisted client-side via Zustand's `persist` middleware. Selection (`selectedIds`) and wizard step are explicitly excluded — reload should not resurrect them.
- **Summary / action items** are cached in SWR's in-memory cache. Re-opens are instant; restart blows them away (acceptable since the user can re-trigger generation).
- **Recorded audio is transient.** It lives only in `useRecording`'s component state (and as the multipart payload of one request to `/api/transcribe`), then it is dropped. There is no audio archive on the client or server — only the produced transcript is persisted.

## Limitations / out of scope

- No real application-level authentication. `/api/auth/login` accepts any valid email + password ≥ 6 chars; the session is the client-side `authStore`. Swap-in seam for a real IdP is the `authStore` + the login route. (For public Vercel deployments, the separate HTTP Basic Auth gate above keeps the metered API routes from being abused — that gate is deployment access, not user identity.)
- No cross-device sync. localStorage only.
- **Transcription is batch, not live.** The audio is uploaded after the user stops the recording; there is no live captioning during capture. Live partials are out of scope.
- **Maximum recording size is 25 MB** — Whisper's hard cap. On default `MediaRecorder` settings (opus @ ~24 kbps) that is roughly 2+ hours of audio, but on Vercel's Hobby tier the request body cap is 4.5 MB, which effectively caps audio to ~25 minutes. Longer recordings surface the `TranscriptionFallback` with `TOO_LARGE` and Retry hidden.
- No cross-tab live updates. Best-effort consistency.
- No durability — server restart empties the meeting store.
- Mobile browsers are best-effort, not v1 acceptance.

## Test counts

### v1 cut (baseline, feature 001 only)

```
Test Suites: 38 passed, 38 total
Tests:       233 passed, 233 total
```

| Layer | Suites | Tests |
|---|---|---|
| Schemas (meeting, transcript, claude, auth, cacheKeys) | 5 | 34 |
| Stores (uiStore, meetingStore, authStore) | 3 | 21 |
| Fetchers (meetings, claude, auth) | 3 | 29 |
| Hooks (useMeetings, useMeeting, useCreateMeeting, useUpdateTranscript, useCreateMeetingForm, useRecording, useSummary, useActionItems, useLoginForm) | 9 | 50 |
| Server (meetingStore, prompts) | 2 | 17 |
| Components (cards, lists, modal, recording, transcript, summary, action items, filters, login, dashboard layout) | 11 | 56 |
| API routes (meetings ×2, claude, auth/login) | 4 | 26 |
| Security | 1 | 3 (`api-key-isolation`) |

### After feature 002 (current)

```
Test Suites: 52 passed, 52 total
Tests:       308 passed, 308 total
```

What feature 002 added on top of v1:

| Layer | New suites | New tests |
|---|---|---|
| Schemas (`transcribe.schema`) | 1 | 8 |
| Fetchers (`transcribe.fetcher`) | 1 | 12 |
| Hooks (`useTranscribeRecording`, `useRecording` extension for `clearAudio`) | 1 | 6 |
| Components (`TranscriptionReview` ×5 files, `TranscriptionFallback`, round-trip, downstream, meeting-detail integration, manual-fallback) | 10 | 39 |
| API routes (`transcribe.route`) | 1 | 9 |
| Cache keys + Security (extensions to existing files) | — | 4 |
| **Total added** | **14** | **75** |

## Time estimate (by hand / no AI-assist)

### Feature 001 — Fireflies clone baseline (125 tasks)

Built across roughly seven AI-pair sessions following the Speckit workflow (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → eight TDD passes for the 125 tasks). Approximate effort if a single developer were to run the same plan by hand:

| Phase | Tasks | Approx. effort |
|---|---|---|
| 1 — Setup | 12 | 2 h |
| 2 — Foundational | 13 | 3 h |
| 3 — US1 (capture + transcript, MVP) | 40 | 12 h |
| 4 — US2 (streaming summary) | 15 | 4 h |
| 5 — US3 (action items) | 13 | 3 h |
| 6 — US4 (filters + pagination) | 11 | 2 h |
| 7 — US5 (sign-in gate) | 14 | 3 h |
| 8 — Polish + CI + security | 7 | 1.5 h |
| **Total** | **125** | **~30 h** |

### Feature 002 — Automatic transcription from recording (36 tasks)

Layered on top of 001 — replaces the manual-paste path with an automatic speech-to-text flow (`whisper-1`), preserves manual entry as the failure fallback, and changes no v1 schemas.

| Phase | Tasks | Approx. effort |
|---|---|---|
| 1 — Setup (openai SDK + env) | 2 | 0.5 h |
| 2 — Foundational (schema, fetcher, hook, route, security gate) | 13 | 4 h |
| 3 — US1 (auto-transcribe on stop, MVP) | 5 | 2 h |
| 4 — US2 (review + edit gate) | 4 | 1.5 h |
| 5 — US3 (failure fallback) | 7 | 2 h |
| 6 — Polish (coverage, README, security) | 5 | 1 h |
| **Total** | **36** | **~11 h** |

## Actual time spent (AI-assisted, with the same plan)

Derived from git history:

- **Feature 001**: first commit `2026-05-17 20:30 +0800` → tag at `2026-05-18 01:29 +0800` ≈ **~5 hours** wall-clock, single contiguous session.
- **Feature 002**: appended in the same session immediately after 001, finishing at `2026-05-18 02:50 +0800` ≈ **~1.5 hours** wall-clock for the additive 36 tasks.
- **Combined**: **~6.5 hours** wall-clock across both features.

## Where to read next

### Feature 001 — Fireflies clone baseline

- [`specs/001-fireflies-clone/spec.md`](specs/001-fireflies-clone/spec.md) — the WHAT and WHY, technology-agnostic
- [`specs/001-fireflies-clone/plan.md`](specs/001-fireflies-clone/plan.md) — the architecture and constitution gates
- [`specs/001-fireflies-clone/research.md`](specs/001-fireflies-clone/research.md) — the open technical questions resolved during planning (12 entries)
- [`specs/001-fireflies-clone/data-model.md`](specs/001-fireflies-clone/data-model.md) — entity reference + cache-key factory
- [`specs/001-fireflies-clone/contracts/`](specs/001-fireflies-clone/contracts/) — HTTP wire contracts for `/api/meetings/*` and `/api/claude`
- [`specs/001-fireflies-clone/quickstart.md`](specs/001-fireflies-clone/quickstart.md) — TDD loop walkthrough and troubleshooting
- [`specs/001-fireflies-clone/tasks.md`](specs/001-fireflies-clone/tasks.md) — the 125-task dependency-ordered build list

### Feature 002 — Automatic transcription from recording

- [`specs/002-recording-transcription/spec.md`](specs/002-recording-transcription/spec.md) — the WHAT and WHY of replacing the manual-paste path
- [`specs/002-recording-transcription/plan.md`](specs/002-recording-transcription/plan.md) — provider choice, key isolation, and the additive file plan
- [`specs/002-recording-transcription/research.md`](specs/002-recording-transcription/research.md) — 11 decisions including provider, transport, fallback shape, no-speech detection
- [`specs/002-recording-transcription/data-model.md`](specs/002-recording-transcription/data-model.md) — what's transient vs persisted; no v1 shape changes
- [`specs/002-recording-transcription/contracts/transcribe.md`](specs/002-recording-transcription/contracts/transcribe.md) — `POST /api/transcribe` wire contract
- [`specs/002-recording-transcription/quickstart.md`](specs/002-recording-transcription/quickstart.md) — env, TDD ladder, and the smoke check
- [`specs/002-recording-transcription/tasks.md`](specs/002-recording-transcription/tasks.md) — the 36-task dependency-ordered build list
