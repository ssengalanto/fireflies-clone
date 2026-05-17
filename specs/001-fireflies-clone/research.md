# Phase 0 Research: Fireflies Clone

This document resolves every technical unknown surfaced during `Technical Context` and locks in the conventions the rest of the plan can reference. Each entry has a **Decision**, the **Rationale**, and the **Alternatives considered** so a future reader can re-evaluate without re-doing the analysis.

---

## R-001 — How does the "API routes read/write localStorage" idea actually work?

**Decision**: API routes are the **single source of truth** for meeting data and run server-side in Next.js. They use a module-level `Map<string, Meeting>` in `lib/server/meetingStore.ts`, seeded once per cold start from `data/meetings.seed.json` (or empty if the file is absent). Browser-side `localStorage` is **not** used for meeting data — it is used only by Zustand's `persist` middleware for UI state (filters, meeting draft, auth session).

**Rationale**: Browser `localStorage` is not accessible from a server-side route handler — they run in a different process. The original spec phrasing "Meetings live in localStorage, read/written through Next.js API routes" describes a pattern impossible to implement literally. Two coherent re-interpretations exist; we chose the server-side in-memory Map because:

1. It keeps SWR's mental model honest: SWR fetches from `/api/meetings`, and `/api/meetings` is authoritative. No phantom client-side cache fighting it.
2. It matches what every example in `fireflies-swr/references/hooks.md` assumes (the fetcher hits a URL, the URL returns canonical data).
3. It makes the API contract testable in isolation — request in, response out, no browser-coupled state.

Data does not survive a server restart in dev (the Map empties), which is the cost. For v1 that is acceptable: the seed file recreates a useful starting set on every boot. If persistence across restarts becomes a v1 acceptance requirement, swap the Map for a JSON file write inside `lib/server/meetingStore.ts` — same interface, same fetcher contract.

**Alternatives considered**:
- **`localStorage` as the source of truth, API routes proxy back via the request body.** Rejected: the API routes lose the only thing that makes them useful — being authoritative. Every call would have to round-trip the full meeting set through the request body, which is absurd at scale, and you re-introduce the "two-sources-of-truth" bug that the SWR-vs-Zustand separation is specifically there to prevent.
- **No API routes; Zustand persists the meetings list directly.** Rejected: the spec explicitly mandates the API route layer, and bypassing it would mean SWR has no fetcher target and the AI-orchestration symmetry (browser → `/api/claude`) doesn't extend to `/api/meetings`.
- **SQLite via `better-sqlite3` for real durability.** Rejected for v1 — extra native dep, build complexity, and it's overkill for a demo with no cross-session retention requirement. Listed as the obvious follow-up if v2 needs durability.

---

## R-002 — Which Claude model, and what's the API shape?

**Decision**:
- **Model constant** (single source of truth): `MODEL = 'claude-opus-4-7'`, exported from `lib/server/prompts.ts`. The route handler imports this constant — never inlines the string.
- **Summary** uses `client.messages.stream({...})` (streaming, prose).
- **Action items** use `client.messages.create({...})` (non-streaming, JSON-shaped output).
- Both calls include a `system` prompt built by `buildSummaryPrompt()` / `buildActionItemsPrompt()` in `lib/server/prompts.ts`.

**Rationale**: Per `fireflies-claude-api`, Opus is the default for user-facing AI output where quality matters. Summary streams because the user perceives the latency; action items don't stream because you can't parse a partial JSON object and the streaming overhead exceeds the response time for a short list. Centralising the model constant lets us A/B against `claude-sonnet-4-6` later by changing one line.

**Alternatives considered**:
- **Sonnet for both.** Cheaper, slightly faster. Rejected for v1 quality bar but kept as the obvious cost-optimisation lever. Documented in `research.md` so a single PR can flip it.
- **Streaming action items.** Rejected — partial JSON is unparseable. Even if the model emits well-formed deltas, the client would have to buffer and parse only at end, which defeats the purpose of streaming.
- **Hardcoded model string at each call site.** Rejected — when the model retires (Claude models do retire), we'd have to chase the string through every route. One exported constant fixes that.

---

## R-003 — How do we surface a `ReadableStream` from a Next.js App Router route, and how does SWR cache the concatenated string?

**Decision**: `app/api/claude/route.ts` returns a `Response` whose body is the `ReadableStream<Uint8Array>` produced by the Anthropic SDK's `messages.stream()`. The browser-side fetcher in `lib/fetchers/claude.fetcher.ts` reads the stream via `res.body.getReader()` and yields chunks to the consumer through an async iterator. Concretely:

- **For component streaming display** (the summary view): a local `useState<string>` accumulates chunks as the iterator yields. This is the path used in `components/summary/SummaryView.tsx`.
- **For SWR caching** (so re-opens are instant): once the stream is exhausted, the **final concatenated string** is what `useSummary` returns as its cached value. `useSummary` uses the immutable config bundle (`revalidateIfStale/OnFocus/OnReconnect: false`) so a second visit shows the cached string immediately with no second API call.

This means streaming UX and SWR caching coexist: the *first* generation streams visibly into the component (driven by the fetcher's async iterator); the *cached* read on re-open uses the final string from SWR's Map and renders synchronously. The two paths share a fetcher and a key, so there is no duplicated state.

**Rationale**: SWR caches whatever the fetcher resolves to. If the fetcher resolves with the final concatenated string, the cache holds the final string. Streaming has to happen *inside* the fetcher's async path before resolution, and the component watches the same value via a `useState` updated by the iterator. This matches the pattern in `fireflies-claude-api/references/hooks.md` exactly — we are not inventing anything new.

**Alternatives considered**:
- **Cache the chunks array, replay it on remount.** Rejected — re-opening should feel instant, not re-play the streaming animation. Replaying is misleading (the user thinks regeneration is happening when it isn't).
- **Skip SWR for streaming, use only `useState`.** Rejected — we'd lose the immutable cache for re-opens, and SC-003 ("cached output renders instantly") would fail.
- **Server-Sent Events with a custom protocol.** Rejected — plain `ReadableStream<Uint8Array>` over fetch is what `messages.stream()` already gives us, and the browser already knows how to read it. SSE adds a layer for no benefit here.

---

## R-004 — How do we defensively parse action-item JSON when the model occasionally wraps it in markdown fences?

**Decision**: A single defensive parser in `lib/fetchers/claude.fetcher.ts`, with this exact shape (per `fireflies-claude-api/references/hooks.md`):

```ts
function parseActionItems(raw: string): ActionItem[] {
  const clean = raw.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed as ActionItem[] : []
  } catch {
    return []
  }
}
```

The fetcher returns `ActionItem[]` (never throws on parse failure). `useActionItems` therefore always resolves with an array — the failure mode is "empty list" plus a non-blocking notice surfaced by the route on a separate error channel if the upstream call itself failed.

**Rationale**: FR-010 and FR-011 say the system must tolerate fenced JSON and must default to `[]` on parse failure rather than crash. A single parser keeps the recovery logic in one place where it can be unit-tested directly (no SWR wrapper needed — it's a pure function).

**Alternatives considered**:
- **Strict parsing, surface errors.** Rejected — the spec explicitly requires graceful degradation.
- **Per-component parsing.** Rejected — duplicating the regex/try/catch across consumers is exactly the kind of subtle drift the skill specs warn against.
- **Ask the model to use a tool-call instead of free-form JSON.** Deferred. It's the cleanest long-term fix but adds tool-definition complexity that isn't earning its keep at v1 quality bar. Documented as a future improvement.

---

## R-005 — Jest setup: what does the test environment look like, and how do we polyfill `MediaRecorder`?

**Decision**:
- `jest.config.ts` with `testEnvironment: 'jsdom'`, `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']`, path aliases via `moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' }`, and `ts-jest` transform.
- `jest.setup.ts` imports `@testing-library/jest-dom` and installs a minimal `MediaRecorder` shim:

  ```ts
  global.MediaRecorder = jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    state: 'inactive',
    ondataavailable: null,
    onstop: null,
  })) as unknown as typeof MediaRecorder
  global.navigator.mediaDevices = { getUserMedia: jest.fn().mockResolvedValue({}) } as MediaDevices
  ```

- `__tests__/utils/wrapper.tsx` exports `createTestWrapper()` returning a fresh `<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false }}>`.
- `__tests__/utils/stores.ts` exports `resetStores()` that calls `setState` on each Zustand store with its known initial state. Called from `beforeEach` in every test that touches stores.

**Rationale**: jsdom does not ship `MediaRecorder` or `getUserMedia`. The shim is intentionally minimal — only the methods/properties `useRecording` actually calls — because polyfilling everything we *might* need leads to tests passing on shims that don't reflect reality. Mock at the network boundary (fetcher) for SWR tests, not at the hook boundary, per `fireflies-tdd`.

**Alternatives considered**:
- **`whatwg-fetch` + MSW for the network layer.** Considered. Worth doing if integration coverage grows, but `jest.mock('@/lib/fetchers/...')` is enough for unit-level hook tests and avoids the MSW handler-management overhead.
- **Use Vitest instead of Jest.** Vitest is faster but the project explicitly chose Jest. Sticking with Jest avoids re-litigating the choice.
- **Stub `MediaRecorder` per-test.** Rejected — too easy to forget in a new test file; the global shim with `mockClear()` between tests keeps coverage uniform.

---

## R-006 — `useSWRInfinite` `getKey` shape that interacts cleanly with Zustand filters and resets pagination on filter change

**Decision**: `useMeetings` reads `filters` from `meetingStore` via a granular selector, then constructs the key per page like:

```ts
const filters = useMeetingStore((s) => s.filters)
const getKey = (pageIndex: number, prev: MeetingPage | null) => {
  if (prev && !prev.nextCursor) return null
  return ['/api/meetings', filters, pageIndex] as const
}
```

Changing any field in `filters` produces a new key shape, which causes SWR to throw away the existing pages and refetch from page 0 — there is no manual `setSize(1)` call needed. Per `fireflies-swr/references/hooks.md`, we also set `revalidateFirstPage: false` to avoid refetching page 0 every time `setSize` increases.

**Rationale**: SWR keys are compared by their stable JSON serialisation, so a different `filters` object produces a different serialised key automatically. We never store the cursor or pagination position in Zustand — that would re-introduce a server-state duplicate that the constitution gate forbids.

**Alternatives considered**:
- **Manual pagination reset with `mutate(filterKeyPrefix, undefined)` on filter change.** Rejected — needlessly imperative when the key-change mechanism gives it to us for free.
- **Combine `filters` and `cursor` in Zustand.** Rejected — the cursor is server state and belongs in SWR's cache, not the store.

---

## R-007 — Zustand v4 `persist` + `partialize` shape and store reset strategy for tests

**Decision**:
- Use `zustand@^4.5+` with `persist` middleware imported from `zustand/middleware`. `partialize` returns the subset to persist.
- `meetingStore`: `partialize: (s) => ({ filters: s.filters, meetingDraft: s.meetingDraft })`. `selectedIds` and `wizardStep` are explicitly excluded — the spec calls out that stale selections and mid-wizard state cause confusion on reload.
- `authStore`: persisted in full.
- `uiStore`: no `persist` wrapper at all.
- Test reset (per `fireflies-tdd/references/setup.md`):

  ```ts
  export function resetStores() {
    useUIStore.setState({ sidebarOpen: true, activeModal: null, modalPayload: null })
    useMeetingStore.setState({ selectedIds: [], filters: DEFAULT_FILTERS, meetingDraft: null, wizardStep: 0 })
    useAuthStore.setState({ user: null, isAuthenticated: false })
  }
  ```

  Called from `beforeEach`, not `beforeAll`.

- **Granular selectors only**: components always do `useMeetingStore((s) => s.filters)`, never `const store = useMeetingStore()`. This is enforced in code review (and can later be enforced by an eslint rule).

**Rationale**: This is the exact shape the spec dictates and the `fireflies-tdd` skill specs assume. The granular-selector rule is a `Why:` more than a `What:` — without it every store mutation triggers a re-render of every component that consumes the store, which silently murders performance once the dashboard has a few hundred meetings.

**Alternatives considered**:
- **Persist `selectedIds` for "remember my last selection".** Rejected explicitly in the spec — stale-on-reload state is confusing and the cost of restoring isn't worth the value.
- **`createJSONStorage(() => sessionStorage)` for `meetingStore`.** Rejected — sessionStorage doesn't survive a tab close, which defeats the purpose of persisting filters.
- **Combine all stores into one.** Rejected — domain separation enforces the "no server state in stores" gate naturally; one mega-store invites violations.

---

## R-008 — shadcn/ui primitives to install up-front

**Decision**: We install only the primitives this feature actually uses. Adding more later is a one-line `npx shadcn-ui@latest add <name>` operation, so there's no penalty for being minimal now.

Initial set:
- `button`, `input`, `textarea`, `label`
- `form` (provides the `<Form>`, `<FormField>`, `<FormControl>`, `<FormMessage>` wrappers that `fireflies-forms` mandates for a11y)
- `dialog` (modals — used by `NewMeetingModal`)
- `select` (status filter)
- `card`, `skeleton` (meeting list + loading states)
- `toast` (non-blocking error notices for parse failures)

**Rationale**: `fireflies-forms` requires shadcn's `<FormMessage />` for accessibility wiring (`aria-describedby`, `aria-invalid` association). Skipping these primitives and rolling our own breaks the a11y guarantee. The other primitives map 1:1 to UI surfaces in the spec.

**Alternatives considered**:
- **Headless UI alone.** Rejected — would require rebuilding the form wrapper layer that shadcn already provides.
- **MUI / Chakra.** Rejected — opinionated styling fights Tailwind, and shadcn is the project's chosen direction.

---

## R-009 — When does the optimistic create happen, and what does `populateCache` do here?

**Decision**: `useCreateMeeting` uses bound `mutate` from `useSWR('/api/meetings', fetcher)`. The pattern:

```ts
await mutate(
  async () => createMeetingFetcher(input),       // the actual server call
  {
    optimisticData: (current = []) => [
      { ...input, id: `temp-${crypto.randomUUID()}`, status: 'recorded', createdAt: new Date().toISOString() },
      ...current,
    ],
    rollbackOnError: true,                       // mandatory; SWR does NOT rollback by default
    populateCache: true,                         // server's returned record replaces the temp one
    revalidate: false,                           // we already have the canonical record from the server response
  },
)
```

`populateCache: true` + `revalidate: false` together mean: "use the value the mutation function returned as the new canonical cache entry, and don't go fetch again." This is the correct combination when the server returns the *complete* new record. If `createMeetingFetcher` returned only an id, we'd flip to `populateCache: false, revalidate: true` so SWR refetches the list. Plan locks in returning the full record.

**Rationale**: `fireflies-swr/references/mutations.md` is explicit about this combination. The `temp-` prefix on optimistic IDs is the agreed marker so the UI can render a pending state distinct from confirmed items (FR-024).

**Alternatives considered**:
- **`revalidate: true`** — wasted network call when the server already gave us the canonical record.
- **Global `mutate` instead of bound `mutate`.** Reserved for cross-cache fanout (e.g. clearing auth caches on logout). For create-on-a-list, bound `mutate` is the simpler tool.
- **No optimistic update.** Rejected — FR-024 mandates immediate appearance.

---

## R-010 — `useRecording` API shape: what does it expose, and why isn't it in Zustand?

**Decision**: `useRecording` is a self-contained hook that holds `MediaRecorder` state in component-local `useState`/`useRef` and exposes:

```ts
{
  status: 'idle' | 'recording' | 'paused' | 'stopped',
  elapsed: number,                  // seconds since start; ticks via setInterval while recording
  start: () => Promise<void>,
  stop: () => void,
  pause: () => void,
  resume: () => void,
  audioBlob: Blob | null,           // available after stop()
}
```

Recording state is **never** in Zustand. The recording is ephemeral, tied to a single component instance, and resetting it across tabs makes no sense. If the user navigates away mid-recording, the recording is lost — that's the documented behaviour in the spec's edge cases section.

**Rationale**: Per `fireflies-zustand` conventions (and the spec), Zustand owns UI state that the whole app cares about — modals, filters, drafts. A `MediaRecorder` instance is owned by a specific component (`RecordingControls`) and dies with it. Hoisting it into a store would invite the recording to "leak" across navigations in confusing ways.

**Alternatives considered**:
- **Hoist into Zustand for "pause-resume across pages".** Rejected — the spec explicitly calls "Browser reload mid-recording: in-progress recording is lost" as the intended edge-case behaviour.
- **Store `MediaRecorder` in a ref outside React.** Rejected — useState/useRef inside the hook is enough and stays cleanly testable.

---

## R-011 — Auth: how thin is the "soft gate"?

**Decision**: A stub `POST /api/auth/login` accepts any email + password ≥ 6 chars, returns a synthetic `User { id, email, displayName }`, and the client's `useLoginForm` stores it in `authStore` (which is fully persisted). A protected layout (`(dashboard)/layout.tsx`) reads `useAuthStore` and redirects to `/login` if `isAuthenticated === false`.

No real identity provider, no password verification, no JWT issuance. The Assumption in the spec explicitly says this is a soft gate — this is the implementation of that assumption.

**Rationale**: Matches `FR-019/020/021` literally and lines up with the "single user per device" assumption. A real identity backend is a v2 swap behind the same `authStore` interface.

**Alternatives considered**:
- **NextAuth with a credentials provider.** Rejected — overkill for the local-only acceptance criterion; adds a config surface that doesn't earn its keep at v1.
- **Skip auth entirely.** Rejected — the spec mandates it (FR-019, US5) and the login surface is needed for the v2 swap path.

---

## R-012 — TDD ordering enforced in `/speckit-tasks` output

**Decision**: Each user story slice in `tasks.md` will list tasks in strict layer order:

1. Schema test → schema implementation
2. Store test → store implementation
3. Fetcher test → fetcher implementation
4. Hook test → hook implementation
5. Component test → component implementation
6. Route handler test → route handler implementation (where the slice touches the API)

A task that writes implementation before its test is a constitution-gate failure. This will be encoded into the `tasks.md` template when `/speckit-tasks` runs.

**Rationale**: `fireflies-tdd` is non-negotiable on this ordering. Mentioned here so the `/speckit-tasks` step doesn't re-litigate it.

**Alternatives considered**: None. The constitution is settled.

---

## Summary of resolved unknowns

| ID | Question | Resolution |
|---|---|---|
| R-001 | Where do meetings actually live? | Server-side in-memory `Map` in `lib/server/meetingStore.ts`, seeded from `data/meetings.seed.json`. Client `localStorage` is only for Zustand-persisted UI state. |
| R-002 | Which Claude model and API shape? | `claude-opus-4-7`, summary streams, action items non-streaming. Model constant exported from `lib/server/prompts.ts`. |
| R-003 | Streaming AI response from App Router → SWR cache? | Fetcher returns an async iterator that yields chunks; component accumulates via `useState`; SWR caches the final concatenated string; re-opens are instant. |
| R-004 | Defensive action-item JSON parsing? | Single regex-strip + `try/catch` parser in `lib/fetchers/claude.fetcher.ts`, defaulting to `[]`. |
| R-005 | Jest env + MediaRecorder polyfill? | jsdom + minimal `MediaRecorder` shim in `jest.setup.ts`. Mock at the fetcher boundary, never at the hook. |
| R-006 | `useSWRInfinite` + Zustand filters? | Filters flow into the key tuple; SWR auto-refetches on filter change; cursor stays in SWR cache, never in Zustand. |
| R-007 | Zustand persist + reset for tests? | Persist via `zustand/middleware`'s `persist` + `partialize`; `resetStores()` in `beforeEach`. |
| R-008 | Initial shadcn primitives? | button, input, textarea, label, form, dialog, select, card, skeleton, toast. |
| R-009 | Optimistic create combination? | `populateCache: true` + `revalidate: false`, `rollbackOnError: true`. Server returns full record. |
| R-010 | `useRecording` state location? | Component-local via `useState`/`useRef`. Never in Zustand. Reload kills the recording — documented behaviour. |
| R-011 | Auth thickness? | Stub login route + `authStore` full persist. Real IdP is a v2 swap. |
| R-012 | TDD ordering in tasks.md? | Strict schema → store → fetcher → hook → component → route order, enforced when `/speckit-tasks` generates the task list. |

All unknowns resolved. Proceeding to Phase 1.
