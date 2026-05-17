# Fireflies Clone

A single-user, local-first meeting capture app. Record audio in the browser, supply a transcript, then have Claude produce a streaming summary and a structured list of action items. Built TDD-first with Next.js 14, SWR, Zustand, react-hook-form, zod, Tailwind, and shadcn/ui.

The full spec, design plan, research log, and task list live under [`specs/001-fireflies-clone/`](specs/001-fireflies-clone/).

## Setup

Prerequisites:
- **Node.js 20+** (Next.js 14 minimum)
- **pnpm 10+**
- An **Anthropic API key** with access to `claude-opus-4-7` (server-only — never reaches the browser)

```bash
pnpm install
cp .env.example .env.local
# edit .env.local and fill in ANTHROPIC_API_KEY
pnpm dev    # http://localhost:3000
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Read once in `app/api/claude/route.ts`. **Never** prefix with `NEXT_PUBLIC_` — that would inline it into the client bundle at build time. |
| `NEXT_PUBLIC_APP_NAME` | no | Cosmetic; defaults to `"Fireflies Clone"`. |

A static security test (`__tests__/security/api-key-isolation.test.ts`) asserts that:
1. `@anthropic-ai/sdk` is imported by exactly one file (the route handler).
2. `process.env.ANTHROPIC_API_KEY` is read directly there.
3. No `NEXT_PUBLIC_*ANTHROPIC*` variable exists in `.env.example`.

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

app/api/        the wire-level API — `meetings/*`, `claude`, `auth/login`
app/(auth)/     unauthenticated routes (login)
app/(dashboard) protected routes (dashboard, meeting detail); auth gate in layout

components/ui/         shadcn primitives only
components/meetings/   MeetingCard, MeetingList, MeetingFilters, NewMeetingModal
components/recording/  RecordingControls, RecordingTimer (MediaRecorder, component-local state)
components/transcript/ TranscriptView, TranscriptEditor
components/summary/    SummaryView, ActionItems
components/auth/       LoginForm

__tests__/      mirrors the source tree; layer-ordered (schemas/, store/, fetchers/, hooks/, components/, api/, server/, security/, utils/)
```

The rule the file tree encodes: **if you're about to write `fetch(...)` inside a component or hook test, stop — it belongs in `lib/fetchers/`. If you're about to import `swr` outside `lib/hooks/`, stop — components consume hooks, never SWR directly. If you're about to import `@anthropic-ai/sdk` outside `app/api/claude/route.ts`, stop — there are no exceptions.**

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

## Data persistence

- **Meetings** live in a server-side in-memory `Map<string, Meeting>` (`lib/server/meetingStore.ts`), seeded once per cold start from `data/meetings.seed.json`. The map empties on server restart — acceptable for v1; swap for a JSON write or SQLite if v2 needs durability.
- **UI state** (filters, in-progress draft, auth session) is persisted client-side via Zustand's `persist` middleware. Selection (`selectedIds`) and wizard step are explicitly excluded — reload should not resurrect them.
- **Summary / action items** are cached in SWR's in-memory cache. Re-opens are instant; restart blows them away (acceptable since the user can re-trigger generation).

## Limitations / out of scope for v1

- No real authentication. `/api/auth/login` accepts any valid email + password ≥ 6 chars; the session is the client-side `authStore`. Swap-in seam for a real IdP is the `authStore` + the login route.
- No cross-device sync. localStorage only.
- No automatic speech-to-text. The user types or pastes the transcript after stopping the recording.
- No cross-tab live updates. Best-effort consistency.
- No durability — server restart empties the meeting store.
- Mobile browsers are best-effort, not v1 acceptance.

## Test counts at v1 cut

```
Test Suites: 38 passed, 38 total
Tests:       233 passed, 233 total
```

Broken down by layer:

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

## Time estimate

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

## Where to read next

- [`specs/001-fireflies-clone/spec.md`](specs/001-fireflies-clone/spec.md) — the WHAT and WHY, technology-agnostic
- [`specs/001-fireflies-clone/plan.md`](specs/001-fireflies-clone/plan.md) — the architecture and constitution gates
- [`specs/001-fireflies-clone/research.md`](specs/001-fireflies-clone/research.md) — the open technical questions resolved during planning (12 entries)
- [`specs/001-fireflies-clone/data-model.md`](specs/001-fireflies-clone/data-model.md) — entity reference + cache-key factory
- [`specs/001-fireflies-clone/contracts/`](specs/001-fireflies-clone/contracts/) — HTTP wire contracts for `/api/meetings/*` and `/api/claude`
- [`specs/001-fireflies-clone/quickstart.md`](specs/001-fireflies-clone/quickstart.md) — TDD loop walkthrough and troubleshooting
- [`specs/001-fireflies-clone/tasks.md`](specs/001-fireflies-clone/tasks.md) — the 125-task dependency-ordered build list
