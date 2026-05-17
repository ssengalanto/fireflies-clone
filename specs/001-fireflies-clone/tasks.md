---

description: "Dependency-ordered, TDD-first task list for the Fireflies clone"
---

# Tasks: Fireflies Clone

**Input**: Design documents from `/specs/001-fireflies-clone/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: REQUIRED. The project's effective constitution (`fireflies-tdd`) makes TDD non-negotiable. Within every story, tests are written first and must fail before the implementation that satisfies them is written. The strict layer order is **schema → store → fetcher → hook → component → route** (locked in by R-012).

**Organization**: Tasks are grouped by user story (US1 → US5) so each story is independently testable and deployable. US1 alone is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on a pending task.
- **[Story]**: `[US1]`–`[US5]` for story-phase tasks; absent for Setup, Foundational, and Polish.
- File paths are absolute relative to repo root.

## Path Conventions

Single Next.js App Router project (see `plan.md` § Project Structure). Source under `app/`, `components/`, `lib/`. Tests under `__tests__/`. All paths below assume that root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the Next.js project, install dependencies, and lay down the directory skeleton.

- [ ] T001 Initialize Next.js 14 App Router project with TypeScript and Tailwind via `pnpm create next-app@latest fireflies-clone --typescript --tailwind --eslint --app --src-dir=false --import-alias='@/*'` (executed against the existing repo root — accept defaults that match `plan.md`).
- [ ] T002 [P] Install runtime dependencies: `pnpm add swr@^2 zustand@^4 react-hook-form@^7 zod@^3 @hookform/resolvers@^3 @anthropic-ai/sdk@^0.30 clsx tailwind-merge class-variance-authority lucide-react`.
- [ ] T003 [P] Install dev dependencies: `pnpm add -D jest@^29 jest-environment-jsdom @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 @types/jest ts-jest@^29 @types/node`.
- [ ] T004 [P] Initialize shadcn/ui (`pnpm dlx shadcn-ui@latest init`) and add primitives `button input textarea label form dialog select card skeleton toast` into `components/ui/`.
- [ ] T005 [P] Configure ESLint + Prettier — extend `next/core-web-vitals`, add import-order rule, write `.prettierrc` with 2-space indent + single quotes + trailing commas.
- [ ] T006 Create the directory skeleton per `plan.md` — `app/(auth)/login/`, `app/(dashboard)/meetings/[id]/`, `app/api/{claude,meetings,auth/login}/`, `components/{ui,meetings,recording,transcript,summary}/`, `lib/{api,schemas,fetchers,hooks,store,providers,server}/`, `__tests__/{schemas,store,fetchers,hooks,components,api,server,security,utils}/`, `data/`.
- [ ] T007 Configure `jest.config.ts` — `testEnvironment: 'jsdom'`, `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']`, `moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' }`, `transform: { '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] }`.
- [ ] T008 Configure `jest.setup.ts` — import `@testing-library/jest-dom`, install minimal `global.MediaRecorder` shim and `global.navigator.mediaDevices.getUserMedia` stub per `research.md` R-005.
- [ ] T009 [P] Write `.env.example` listing `ANTHROPIC_API_KEY=` (no value) and `NEXT_PUBLIC_APP_NAME="Fireflies Clone"`. Add `.env.local` to `.gitignore`.
- [ ] T010 [P] Add `data/meetings.seed.json` — three sample meetings: one `draft` (no transcript), one `recorded` (with transcript, no AI outputs), one `summarized` (transcript + cached summary marker for dev). Each with a `mtg_<uuid>` id and ISO timestamps.
- [ ] T011 [P] Finalize `tailwind.config.ts` content paths (`./app/**/*.{ts,tsx}`, `./components/**/*.{ts,tsx}`) and update `app/globals.css` with Tailwind directives plus shadcn theme tokens.
- [ ] T012 [P] Add npm scripts to `package.json` — `dev`, `build`, `start`, `test`, `test:watch`, `typecheck` (`tsc --noEmit`), `lint`.

**Checkpoint**: `pnpm install` clean, `pnpm typecheck` and `pnpm lint` pass on an empty skeleton, `pnpm test` runs with zero tests collected.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the SWR cache-key factory, the `uiStore`, the SWR provider, the server-side meeting store, and the test utilities — every user story depends on these.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete.

- [ ] T013 [P] Write cache-key factory test in `__tests__/schemas/cacheKeys.test.ts` — asserts `meetingKeys.all`, `lists()`, `list(filters)`, `detail(id)`, `summary(id)`, `actionItems(id)` produce the exact tuples documented in `data-model.md`, nest under `detail()`, and survive `JSON.stringify` round-trip without surprise mutation.
- [ ] T014 Implement `lib/api/cacheKeys.ts` — export `meetingKeys` factory matching the test in T013 (`as const` on every tuple).
- [ ] T015 [P] Write `__tests__/store/uiStore.test.ts` — `openModal(name, payload)` sets both fields, `closeModal()` nulls both atomically, `toggleSidebar()` flips the boolean. Reset between tests via `useUIStore.setState({ sidebarOpen: true, activeModal: null, modalPayload: null })` in `beforeEach`.
- [ ] T016 Implement `lib/store/uiStore.ts` — Zustand v4 `create()` (no `persist`); state `{ sidebarOpen, activeModal, modalPayload }`; actions per spec.
- [ ] T017 [P] Write `__tests__/utils/wrapper.tsx` exporting `createTestWrapper()` — returns a `({ children }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false }}>{children}</SWRConfig>` factory; each call closes over a fresh `Map`.
- [ ] T018 [P] Write `__tests__/utils/stores.ts` exporting `resetStores()` — initially resets only `useUIStore`; extended per-story when new stores land.
- [ ] T019 Implement `lib/providers/SWRProvider.tsx` — `'use client'`, mounts global `<SWRConfig>` with default fetcher `(url) => fetch(url).then(r => r.json())`, `dedupingInterval: 60_000`, `errorRetryCount: 1`, `revalidateOnFocus: true`, `shouldRetryOnError: false`.
- [ ] T020 Implement `lib/providers/StoreProvider.tsx` — pass-through client wrapper component that exists as a future hydration boundary; currently just renders `children`.
- [ ] T021 Implement `app/layout.tsx` — root layout mounting `<SWRProvider><StoreProvider>{children}</StoreProvider></SWRProvider>`, sets HTML lang/font/title, imports `app/globals.css`.
- [ ] T022 [P] Write `__tests__/server/meetingStore.test.ts` — `seedFromFile()` populates the map idempotently, `list({ search, status, cursor, limit })` filters by `search` (title + participants, case-insensitive) and `status`, returns `{ items, nextCursor }`, paginates correctly with no overlap; `create(input)` returns a record with `mtg_<uuid>` id and `createdAt`/`updatedAt`; `update(id, patch)` bumps `updatedAt` and recomputes `status`; `remove(id)` makes a subsequent `get(id)` throw.
- [ ] T023 Implement `lib/server/meetingStore.ts` — module-level `Map<string, Meeting>`, lazy `seedFromFile()` reading `data/meetings.seed.json` (gracefully handles missing file), exports `list`, `get`, `create`, `update`, `remove`. Uses `crypto.randomUUID()` for ids.
- [ ] T024 [P] Write `__tests__/security/api-key-isolation.test.ts` — a static check: `grep -r '@anthropic-ai/sdk' app components lib --include='*.ts' --include='*.tsx'` returns at most one file (`app/api/claude/route.ts`); no env var name in `.env.example` starting with `NEXT_PUBLIC_` contains the substring `ANTHROPIC`. Test passes pre-route by asserting the import count is `0` (will become `1` after T076 lands).
- [ ] T025 Implement `app/(dashboard)/layout.tsx` — basic shell with a `<Sidebar>` slot and a `<main>` for children; **no** auth redirect yet (US5 adds that).

**Checkpoint**: `pnpm test` runs T013, T015, T017, T018, T022, T024 — all pass. `pnpm dev` starts cleanly; the root layout renders an empty dashboard. Foundation ready.

---

## Phase 3: User Story 1 — Capture meeting + transcript (Priority: P1) 🎯 MVP

**Goal**: A signed-in (or seeded) user creates a new meeting, records audio, supplies a transcript, and sees the meeting persisted in the dashboard and on its detail page.

**Independent Test**: Open the dashboard (auth bypassed via dev seed), open the new-meeting modal, submit a valid form, click Record on the detail page, click Stop, paste a transcript, save, reload the page, verify the meeting (title, date, participants, duration, transcript) is still present.

### Schemas (TDD layer 1)

- [ ] T026 [P] [US1] Write `__tests__/schemas/meeting.schema.test.ts` — `meetingSchema` and `createMeetingSchema` reject empty title, reject `participants: []`, reject malformed email, reject `date` that isn't ISO 8601; happy path accepts valid input; `actionItemSchema` accepts both `{ owner: null, dueDate: null }` and fully populated forms.
- [ ] T027 [P] [US1] Write `__tests__/schemas/transcript.schema.test.ts` — `updateTranscriptSchema` rejects empty string, rejects > 100 000 chars, accepts a 50-char string.
- [ ] T028 [US1] Implement `lib/schemas/meeting.schema.ts` — `meetingSchema`, `createMeetingSchema = meetingSchema.pick({title, participants, date})`, `actionItemSchema`, with the validation messages from `data-model.md`. Export both Zod schemas and inferred TS types (`Meeting`, `CreateMeetingInput`, `ActionItem`).
- [ ] T029 [US1] Implement `lib/schemas/transcript.schema.ts` — `updateTranscriptSchema` and `UpdateTranscriptInput` type.

### Store (TDD layer 2)

- [ ] T030 [P] [US1] Write `__tests__/store/meetingStore.test.ts` — `setMeetingDraft({...})` sets the draft, `clearMeetingDraft()` nulls it, `setFilter({search: 'x'})` **merges** into existing filters (does not replace the `status` field), `partialize` returned object contains only `filters` and `meetingDraft` (never `selectedIds` or `wizardStep`), granular selectors `(s) => s.filters` cause no re-render when `meetingDraft` changes.
- [ ] T031 [US1] Implement `lib/store/meetingStore.ts` — Zustand v4 `create` wrapped in `persist` middleware with `partialize: (s) => ({ filters: s.filters, meetingDraft: s.meetingDraft })`. Default state: `selectedIds: []`, `filters: { search: '', status: 'all' }`, `meetingDraft: null`, `wizardStep: 0`. Actions per spec.
- [ ] T032 [US1] Extend `__tests__/utils/stores.ts` — add `useMeetingStore.setState({ selectedIds: [], filters: { search: '', status: 'all' }, meetingDraft: null, wizardStep: 0 })` to `resetStores()`.

### Fetchers (TDD layer 3)

- [ ] T033 [P] [US1] Write `__tests__/fetchers/meetings.fetcher.test.ts` — mocks `global.fetch`; asserts `fetchMeetingsPage({search, status, cursor, limit})` builds the right query string, `fetchMeeting(id)` GETs `/api/meetings/[id]`, `createMeeting(input)` POSTs JSON, `updateTranscript(id, transcript)` PATCHes; every helper throws `Error` with the server's `error` message when `!res.ok`.
- [ ] T034 [US1] Implement `lib/fetchers/meetings.fetcher.ts` — plain async functions, no React, no SWR imports. Each helper returns the parsed JSON body (a `Meeting` or `{items, nextCursor}` page). Throws on `!res.ok`.

### Hooks (TDD layer 4)

- [ ] T035 [P] [US1] Write `__tests__/hooks/useMeetings.test.tsx` — wraps in `createTestWrapper()`, mocks `@/lib/fetchers/meetings.fetcher`; asserts initial loading state, success with mocked page data, error surfaces via `result.current.error`, changing the filter in `meetingStore` triggers a new fetch (new key); `setSize` increments don't refetch page 0 (`revalidateFirstPage: false`).
- [ ] T036 [P] [US1] Write `__tests__/hooks/useMeeting.test.tsx` — when `id` is `undefined`, the fetcher mock is never called; valid id resolves with the mocked record; 404 surfaces via `result.current.error`.
- [ ] T037 [P] [US1] Write `__tests__/hooks/useCreateMeeting.test.tsx` — optimistic `temp-` item appears at index 0 of `data` immediately after `trigger`; on fetcher rejection the list rolls back to the prior state; on success the temp item is replaced by the server's `mtg_` record (verified by no second fetch — `revalidate: false`).
- [ ] T038 [P] [US1] Write `__tests__/hooks/useUpdateTranscript.test.tsx` — `trigger(transcript)` calls the PATCH fetcher with the right body; `isMutating` is `true` during the call and `false` after; `trigger` throws on failure (so `await trigger(...)` in the form rejects); detail cache is updated on success.
- [ ] T039 [P] [US1] Write `__tests__/hooks/useCreateMeetingForm.test.tsx` — when `meetingStore.meetingDraft` is non-null on mount, `form.reset(draft)` is called once; every `form.watch` emission writes to `setMeetingDraft`; invalid submit (empty title) blocks `trigger` from being called and surfaces a field error; successful submit calls `trigger → form.reset() → clearMeetingDraft() → closeModal()` in that exact order (verify with a mock call order assertion).
- [ ] T040 [P] [US1] Write `__tests__/hooks/useRecording.test.tsx` — `start()` transitions `status` `'idle'` → `'recording'` and invokes the `MediaRecorder` shim's `start`; `stop()` transitions `'recording'` → `'stopped'`, the `audioBlob` is non-null, the shim's `stop` is called; `elapsed` ticks once per second while recording (use `jest.useFakeTimers()`).
- [ ] T041 [US1] Implement `lib/hooks/useMeetings.ts` — `useSWRInfinite((pageIndex, prev) => prev && !prev.nextCursor ? null : [...meetingKeys.list(filters), pageIndex] as const, ([, , , filters, pageIndex]) => fetchMeetingsPage({...filters, cursor: prev?.nextCursor, limit: 20}), { dedupingInterval: 120_000, revalidateFirstPage: false })`. Reads `filters` from `meetingStore` via granular selector.
- [ ] T042 [US1] Implement `lib/hooks/useMeeting.ts` — `useSWR(id ? meetingKeys.detail(id) : null, () => fetchMeeting(id!), { dedupingInterval: 300_000 })`.
- [ ] T043 [US1] Implement `lib/hooks/useCreateMeeting.ts` — exposes `{ create(input): Promise<Meeting>, isCreating }`. Internally: `const { data, mutate } = useSWR('/api/meetings', fetchMeetingsPage)`; calls `await mutate(async () => { const created = await createMeeting(input); return prepend(created); }, { optimisticData: prepend(tempMeeting), rollbackOnError: true, populateCache: true, revalidate: false })`. Temp IDs prefixed `temp-`.
- [ ] T044 [US1] Implement `lib/hooks/useUpdateTranscript.ts` — `useSWRMutation(meetingKeys.detail(id), (_key, { arg }: { arg: string }) => updateTranscript(id, arg), { populateCache: true, revalidate: false })`.
- [ ] T045 [US1] Implement `lib/hooks/useCreateMeetingForm.ts` — RHF + `zodResolver(createMeetingSchema)` + `defaultValues` derived from `meetingDraft ?? { title: '', participants: [''], date: new Date().toISOString() }`; draft hydrate (once on mount) + `form.watch` → `setMeetingDraft` subscription with cleanup; `onSubmit = form.handleSubmit(async (data) => { await trigger(data); form.reset(); clearMeetingDraft(); closeModal(); })`. Returns `{ form, onSubmit, isPending: isMutating, error }`.
- [ ] T046 [US1] Implement `lib/hooks/useRecording.ts` — owns `MediaRecorder` via `useRef`, `status`/`elapsed`/`audioBlob` via `useState`. `start()` calls `navigator.mediaDevices.getUserMedia({audio:true})`, instantiates a `MediaRecorder`, wires `ondataavailable` and `onstop`; ticker via `setInterval` started in `start()` and cleared in `stop()`. State is component-local — **never** touches Zustand.

### Components (TDD layer 5)

- [ ] T047 [P] [US1] Write `__tests__/components/meetings/MeetingCard.test.tsx` — renders the title, the formatted date (`Intl.DateTimeFormat`), and the formatted duration (`"5m 32s"`). Uses `screen.getByRole('heading', { name: /<title>/ })`.
- [ ] T048 [P] [US1] Write `__tests__/components/meetings/MeetingList.test.tsx` — module-mocks `@/lib/hooks/useMeetings`; loading state shows N skeletons (`role="status"`); success renders one `MeetingCard` per item (assert via `screen.getAllByRole('article')`); empty state shows the explicit "no meetings yet" message.
- [ ] T049 [P] [US1] Write `__tests__/components/meetings/NewMeetingModal.test.tsx` — renders nothing when `uiStore.activeModal !== 'new-meeting'`; renders the form when it is; submit button is disabled while `isPending`; clicking the close affordance calls `closeModal` (verified by mocked store state).
- [ ] T050 [P] [US1] Write `__tests__/components/recording/RecordingControls.test.tsx` — initially shows a Start button; clicking it (via `userEvent.click`) transitions to a Stop button + visible timer; the timer increments after a 1 s `jest.advanceTimersByTime(1000)`; clicking Stop reveals the transcript editor.
- [ ] T051 [P] [US1] Write `__tests__/components/transcript/TranscriptEditor.test.tsx` — module-mocks `@/lib/hooks/useUpdateTranscript`; submit calls `trigger(textareaValue)`; submit button is disabled while `isMutating`; empty submit is blocked with a `<FormMessage />` error.
- [ ] T052 [P] [US1] Write `__tests__/components/transcript/TranscriptView.test.tsx` — renders the meeting's transcript paragraphs; shows a "no transcript yet" placeholder when `meeting.transcript === null`.
- [ ] T053 [US1] Implement `components/meetings/MeetingCard.tsx` — `shadcn/ui` `Card`, presentational; props are a `Meeting`. Formats duration helper inline (no external date lib in v1).
- [ ] T054 [US1] Implement `components/meetings/MeetingList.tsx` — consumes `useMeetings()`; renders skeletons during initial load, the cards on success, and the empty state. Handles `setSize` from a `<Button>` at list end ("Load more") when `nextCursor` exists.
- [ ] T055 [US1] Implement `components/meetings/NewMeetingModal.tsx` — wraps shadcn `Dialog`; gated by `uiStore.activeModal === 'new-meeting'`; consumes `useCreateMeetingForm()`; renders title, participants (`useFieldArray` with `key={field.id}`), and date fields wrapped in shadcn `<Form>`/`<FormField>`/`<FormMessage>` per `fireflies-forms`.
- [ ] T056 [US1] Implement `components/recording/RecordingControls.tsx` + `components/recording/RecordingTimer.tsx` — `RecordingControls` consumes `useRecording()`, conditionally renders Start / Stop / Pause buttons and the `RecordingTimer`. Timer is a presentational component reading `elapsed`.
- [ ] T057 [US1] Implement `components/transcript/TranscriptEditor.tsx` — local RHF form for a single `transcript` field validated via `updateTranscriptSchema`; on submit calls `useUpdateTranscript(meetingId).trigger`.
- [ ] T058 [US1] Implement `components/transcript/TranscriptView.tsx` — presentational; splits transcript on `\n\n` into paragraphs.

### API routes (TDD layer 6)

- [ ] T059 [P] [US1] Write `__tests__/api/meetings.route.test.ts` — directly imports `GET` and `POST` from `app/api/meetings/route.ts`; calls them with a fabricated `NextRequest`; asserts GET returns `{ items, nextCursor }` filtered by query params, POST validates and returns 201 with the full record, POST returns 400 on invalid body, POST-created meeting appears in the next GET.
- [ ] T060 [P] [US1] Write `__tests__/api/meetings.[id].route.test.ts` — GET returns 200 or 404, PATCH validates `updateTranscriptSchema` and returns the updated record, PATCH bumps `updatedAt` and recomputes `status` to `'recorded'` when transcript transitions from null to non-null, DELETE returns 204.
- [ ] T061 [US1] Implement `app/api/meetings/route.ts` — `GET` parses query params via Zod, calls `meetingStore.list(...)`, returns the page; `POST` validates body via `createMeetingSchema`, calls `meetingStore.create(...)`, returns 201 with the canonical record.
- [ ] T062 [US1] Implement `app/api/meetings/[id]/route.ts` — `GET` → `meetingStore.get(id)` or 404; `PATCH` validates `updateTranscriptSchema`, calls `meetingStore.update(id, { transcript })`, returns updated record; `DELETE` → `meetingStore.remove(id)` returns 204.

### Pages

- [ ] T063 [US1] Implement `app/(dashboard)/page.tsx` — dashboard with a "New meeting" button (calls `openModal('new-meeting')`), renders `<MeetingList />` and `<NewMeetingModal />`. Read `useUIStore` via granular selector.
- [ ] T064 [US1] Implement `app/(dashboard)/meetings/[id]/page.tsx` — consumes `useMeeting(params.id)`; if `meeting.transcript === null` show `<RecordingControls />` and `<TranscriptEditor />`; else show `<TranscriptView />` and stub slots for `<SummaryView />` and `<ActionItems />` (filled in US2/US3).
- [ ] T065 [US1] Manual happy-path verification per `quickstart.md`: open dashboard, create a meeting, navigate to detail, record-and-stop, paste a transcript, save, reload, confirm persistence. Resolve any test failures discovered in passing.

**Checkpoint**: US1 is fully functional. The MVP can ship here.

---

## Phase 4: User Story 2 — Generate AI summary from a transcript (Priority: P2)

**Goal**: From a meeting that already has a transcript, the user clicks "Generate summary" and watches prose stream in token by token; re-opens reuse the cached summary instantly.

**Independent Test**: Open a meeting with a saved transcript, click "Generate summary", verify visible tokens within 3 s (manual SC-002 check), let it complete, navigate away and back, verify the cached summary renders instantly with no second API call (verify via network panel or a fetcher spy).

### Schemas + prompts (TDD layer 1)

- [ ] T066 [P] [US2] Write `__tests__/schemas/claude.schema.test.ts` — `claudeRequestSchema` enforces `type: 'summary' | 'action-items'`, `meetingId` is a non-empty string, `transcript` is non-empty and ≥ 50 chars; rejects other types.
- [ ] T067 [US2] Implement `lib/schemas/claude.schema.ts` — the request-body schema described above plus `summaryResponseHeadersSchema` (echoing `X-Meeting-Id`).

### Fetcher (TDD layer 3 — no Zustand state for AI outputs)

- [ ] T068 [P] [US2] Write `__tests__/fetchers/claude.fetcher.test.ts (summary section)` — `fetchSummary({ meetingId, transcript })` returns an async iterator over decoded chunks; given a `Response` whose body is a `ReadableStream` yielding `'Hello '`, `'world'`, the iterator yields the same strings and the final concatenation resolves to `'Hello world'`. Mocks `global.fetch` with a synthetic streaming `Response`.
- [ ] T069 [US2] Implement `lib/fetchers/claude.fetcher.ts (fetchSummary)` — POST to `/api/claude` with `type: 'summary'`; reads `res.body.getReader()`, decodes via `TextDecoder('utf-8', { stream: true })`, yields each chunk via an async generator; resolves with the final concatenated string. Throws on `!res.ok` with the server's `error` message.

### Hook (TDD layer 4)

- [ ] T070 [P] [US2] Write `__tests__/hooks/useSummary.test.tsx` — `useSummary(meetingId, transcript)` returns `null` key when either input is missing; given valid inputs, mocks fetcher to resolve with `"final summary text"`; asserts `result.current.data === 'final summary text'`; immutable config bundle prevents revalidation on focus (`window.dispatchEvent(new Event('focus'))` does not re-call the fetcher).
- [ ] T071 [US2] Implement `lib/hooks/useSummary.ts` — `useSWR(meetingId && transcript && transcript.length >= 50 ? meetingKeys.summary(meetingId) : null, () => fetchSummaryFinal(meetingId, transcript), { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false, errorRetryCount: 1 })`. Also exports a separate `useSummaryStream(meetingId, transcript)` for the live token-by-token render.

### Component (TDD layer 5)

- [ ] T072 [P] [US2] Write `__tests__/components/summary/SummaryView.test.tsx` — module-mocks `useSummary` + `useSummaryStream`; given a cached summary, renders the string immediately with no streaming indicator; given a not-yet-cached state, triggers the stream on a button click and accumulates rendered chunks; given a fetcher error, renders a recoverable error UI with a retry button.
- [ ] T073 [US2] Implement `components/summary/SummaryView.tsx` — "Generate summary" button (hidden if cached); during streaming, accumulates chunks into local `useState<string>` and renders as `<p>`; on completion the cached value via `useSummary` takes over. Per `fireflies-claude-api/references/hooks.md`.

### API route (TDD layer 6)

- [ ] T074 [P] [US2] Write `__tests__/api/claude.route.test.ts (summary section)` — directly invokes `POST` from `app/api/claude/route.ts`; mocks `@anthropic-ai/sdk` so `client.messages.stream` returns a controlled `ReadableStream`; asserts response `Content-Type: text/plain`, `X-Meeting-Id` echoes the request, body streams the mocked chunks; 400 when `transcript.length < 50`.
- [ ] T075 [US2] Write `lib/server/prompts.ts` — export `MODEL = 'claude-opus-4-7' as const`, `buildSummaryPrompt(): string`, and stub `buildActionItemsPrompt(): string` (filled in US3). Add a unit test `__tests__/server/prompts.test.ts` asserting the model constant and that the summary prompt mentions structured prose.
- [ ] T076 [US2] Implement `app/api/claude/route.ts` — **only** file in repo allowed to import `@anthropic-ai/sdk`; reads `process.env.ANTHROPIC_API_KEY` directly; validates body via `claudeRequestSchema`; for `type: 'summary'`, calls `client.messages.stream({...})` and returns its body as a `Response` with `text/plain` and `X-Meeting-Id` set. Errors → 500 with the standard envelope.
- [ ] T077 [US2] Re-run the API-key isolation test from T024 — now expects exactly **one** matching file (`app/api/claude/route.ts`); update the assertion accordingly so it stays green.

### Wire-in

- [ ] T078 [US2] Wire `<SummaryView meeting={meeting} />` into `app/(dashboard)/meetings/[id]/page.tsx` — renders below `<TranscriptView />` only when `meeting.transcript` is present.
- [ ] T079 [US2] Smoke-test SC-002 manually: with a real `ANTHROPIC_API_KEY`, generate a summary on a 1k-character transcript; confirm first token visible within 3 s.
- [ ] T080 [US2] Add server-side response-time logging in `app/api/claude/route.ts` (console-level only — no telemetry pipeline in v1) so we can audit SC-002 across runs.

**Checkpoint**: US1 + US2 both work. Summary streams live and caches across re-opens.

---

## Phase 5: User Story 3 — Extract action items (Priority: P2)

**Goal**: From a meeting with a transcript, the user clicks "Extract action items" and sees a structured list, even when the AI response is wrapped in markdown fences.

**Independent Test**: Open a meeting with a transcript, click "Extract action items", verify a list renders; force-mock the AI response to be wrapped in `` ```json ... ``` `` fences and verify items still render; force-mock a totally malformed response and verify an empty list renders with a non-blocking notice.

### Fetcher (TDD layer 3)

- [ ] T081 [P] [US3] Write `__tests__/fetchers/claude.fetcher.test.ts (action items section)` — `fetchActionItems({ meetingId, transcript })` returns an `ActionItem[]`; given a mocked response of `'```json\n[{"id":"ai_1","text":"x","owner":null,"dueDate":null}]\n```'`, the fetcher returns the array; given totally unparseable text, returns `[]`; given a non-array, returns `[]`. Also asserts each returned item validates against `actionItemSchema`.
- [ ] T082 [US3] Extend `lib/fetchers/claude.fetcher.ts` — add `fetchActionItems` and the `parseActionItems(raw)` helper from R-004; defensively re-validates each item with `actionItemSchema.safeParse` and drops invalid ones.

### Hook (TDD layer 4)

- [ ] T083 [P] [US3] Write `__tests__/hooks/useActionItems.test.tsx` — null key when inputs missing; valid inputs resolve with the mocked array; immutable config prevents focus revalidation; second mount returns cached value without re-fetching.
- [ ] T084 [US3] Implement `lib/hooks/useActionItems.ts` — same shape as `useSummary` but resolves to `ActionItem[]` and uses `meetingKeys.actionItems(meetingId)`.

### Component (TDD layer 5)

- [ ] T085 [P] [US3] Write `__tests__/components/summary/ActionItems.test.tsx` — module-mocks `useActionItems`; given non-empty array, renders one `<li>` per item with text, owner, and due-date; given empty array AND server-set `X-Parse-Fallback` header, renders the empty state with a non-blocking notice; given a fetcher error, renders the recoverable error state.
- [ ] T086 [US3] Implement `components/summary/ActionItems.tsx` — "Extract action items" button (hidden if cached); list rendering via shadcn `Card` + `ul`. Reads the fallback header via SWR's `swrConfig.use` middleware or via a custom fetcher metadata channel (decide during implementation — keep it simple, default to "always show notice when array is empty after a generation attempt").

### API route (TDD layer 6)

- [ ] T087 [P] [US3] Write `__tests__/api/claude.route.test.ts (action items section)` — `POST` with `type: 'action-items'`; mocks `client.messages.create` to return `'```json\n[{"text":"do x"}]\n```'`; asserts response JSON is a valid `ActionItem[]` (parser ran server-side); given totally garbage model output, asserts response is `[]` with `X-Parse-Fallback: empty-list`; 400 on `transcript.length < 50`.
- [ ] T088 [US3] Extend `app/api/claude/route.ts` — `type: 'action-items'` branch: `client.messages.create({...})`, then runs the same `parseActionItems` helper server-side (per R-004), synthesises missing ids as `ai_<n>`, returns JSON. Sets `X-Parse-Fallback: empty-list` header when the parse fell back.
- [ ] T089 [US3] Extend `lib/server/prompts.ts` — fill in `buildActionItemsPrompt()` instructing the model to return a JSON array `[{ text, owner, dueDate }]`. Test in `__tests__/server/prompts.test.ts` asserts the prompt explicitly mentions JSON.

### Wire-in

- [ ] T090 [US3] Wire `<ActionItems meeting={meeting} />` into `app/(dashboard)/meetings/[id]/page.tsx` — renders next to `<SummaryView />` only when `meeting.transcript` is present.
- [ ] T091 [US3] Smoke-test the markdown-fence resilience manually: temporarily wrap a server response in fences via a debug header; confirm the UI still renders the list.
- [ ] T092 [US3] Add `toast`-based non-blocking notice surface (use the shadcn `toast` primitive added in T004) — used when the parse fell back to empty.
- [ ] T093 [US3] Verify SC-004 acceptance threshold informally — extract action items on a handful of real transcripts and confirm > 95% produce a non-empty list; the remainder degrade quietly.

**Checkpoint**: US1 + US2 + US3 all working. Both AI features are live.

---

## Phase 6: User Story 4 — Browse, filter, and search meeting history (Priority: P3)

**Goal**: Users can filter by status and free-text search; selections persist across reloads; pagination loads more on demand.

**Independent Test**: Seed 50+ meetings of mixed status; filter and search; verify the list updates instantly; reload the page; verify the filter and search are still applied.

### Store extensions

- [ ] T094 [P] [US4] Extend `__tests__/store/meetingStore.test.ts` (or add a new file `__tests__/store/meetingStore.filters.test.ts`) — `setFilter({status: 'recorded'})` doesn't clobber `filters.search`; `resetFilters()` returns to default; `partialize` continues to include `filters` after a write.
- [ ] T095 [US4] Confirm/extend `lib/store/meetingStore.ts` actions — `setFilter` does object-spread merge (not replace); add `resetFilters` action if missing.

### Hook test for filter-driven refetch

- [ ] T096 [P] [US4] Extend `__tests__/hooks/useMeetings.test.tsx` — changing `meetingStore.filters.status` from `'all'` to `'recorded'` produces a new SWR key, the fetcher is invoked again, and SWR's cached page-0 from the prior key is left intact (does not bleed into the new query).

### Components

- [ ] T097 [P] [US4] Write `__tests__/components/meetings/MeetingFilters.test.tsx` — typing in the search input calls `setFilter({search: ...})`; choosing a status from shadcn `Select` calls `setFilter({status: ...})`; the inputs are controlled by `meetingStore.filters` (verified by setting store state and asserting input value).
- [ ] T098 [US4] Implement `components/meetings/MeetingFilters.tsx` — search input + status select, both reading and writing `meetingStore.filters` via granular selectors.
- [ ] T099 [US4] Wire `<MeetingFilters />` into `app/(dashboard)/page.tsx` above the `<MeetingList />`.
- [ ] T100 [US4] Extend `__tests__/components/meetings/MeetingList.test.tsx` — pagination: after clicking "Load more", `useMeetings` `setSize` is called; mocked next page renders below the first. Empty state when filters match no meetings.
- [ ] T101 [US4] Extend `components/meetings/MeetingList.tsx` — render the "Load more" button when `nextCursor` exists and is in view; differentiate "no meetings yet" vs "no meetings match your filters" empty states.

### Server side

- [ ] T102 [P] [US4] Extend `__tests__/server/meetingStore.test.ts` — `list({search: 'standup'})` matches case-insensitively against title AND any participant; `list({status: 'recorded'})` only returns meetings whose `status === 'recorded'`; pagination respects the filter (cursor over the filtered set, not the unfiltered one).
- [ ] T103 [US4] Refine `lib/server/meetingStore.ts list(...)` accordingly. Make sure the cursor stays opaque to clients.

### Verification

- [ ] T104 [US4] Manually seed ~50 meetings, exercise filters + reload, verify FR-016 (filters persist, selection/wizard do not).

**Checkpoint**: US1 + US2 + US3 + US4 all working. Dashboard scales to a real history.

---

## Phase 7: User Story 5 — Sign in to access personal meetings (Priority: P4)

**Goal**: A user signs in, lands on the dashboard, stays signed in across reloads, and protected routes redirect to login when unauthenticated.

**Independent Test**: Visit `/` while unauthenticated → redirect to `/login`. Submit valid credentials → land on `/`. Reload `/` → still authenticated. Click sign-out → redirected to `/login`.

### Schema

- [ ] T105 [P] [US5] Write `__tests__/schemas/auth.schema.test.ts` — `userSchema` (email valid, displayName 1–80), `loginInputSchema` (email valid, password ≥ 6 chars).
- [ ] T106 [US5] Implement `lib/schemas/auth.schema.ts` — `userSchema`, `loginInputSchema`, plus inferred `User` and `LoginInput` types.

### Store

- [ ] T107 [P] [US5] Write `__tests__/store/authStore.test.ts` — `setUser(user)` sets `user` and flips `isAuthenticated` to `true`; `clearAuth()` nulls both; the persist hydration restores `user` and `isAuthenticated` correctly after a simulated reload (manual rehydrate call).
- [ ] T108 [US5] Implement `lib/store/authStore.ts` — Zustand v4 with `persist` (full state, no `partialize` exclusions). Update `__tests__/utils/stores.ts` to reset `authStore` in `resetStores()`.

### Fetcher + hook

- [ ] T109 [P] [US5] Write `__tests__/fetchers/auth.fetcher.test.ts` — `login(input)` POSTs to `/api/auth/login` and returns the `User`; throws on `!res.ok`.
- [ ] T110 [US5] Implement `lib/fetchers/auth.fetcher.ts` — `login(input)` plain async function.
- [ ] T111 [P] [US5] Write `__tests__/hooks/useLoginForm.test.tsx` — RHF + zodResolver + `useSWRMutation` flow; submit calls fetcher and on success calls `setUser` then redirects to `/`; invalid input blocks submit.
- [ ] T112 [US5] Implement `lib/hooks/useLoginForm.ts` — form pipeline (validates → triggers → setUser → router.push('/')).

### Component + page + route

- [ ] T113 [P] [US5] Write `__tests__/components/auth/LoginForm.test.tsx` — module-mocks `useLoginForm`; renders email + password fields wrapped in shadcn `<Form>`; submit button is disabled while `isPending`; field errors render via `<FormMessage />`.
- [ ] T114 [US5] Implement `components/auth/LoginForm.tsx` + `app/(auth)/login/page.tsx`.
- [ ] T115 [P] [US5] Write `__tests__/api/auth.login.route.test.ts` — `POST /api/auth/login` accepts any valid email + password ≥ 6 chars; returns the synthesised `User { id, email, displayName }`; 400 on invalid input.
- [ ] T116 [US5] Implement `app/api/auth/login/route.ts` — stub identity per R-011; no real password verification.

### Protected layout

- [ ] T117 [US5] Extend `app/(dashboard)/layout.tsx` — read `useAuthStore.isAuthenticated` via granular selector; if `false`, `redirect('/login')` (Next.js helper). Update `__tests__/components/dashboard/layout.test.tsx` (new) to assert this.
- [ ] T118 [US5] Add a "Sign out" affordance in the dashboard header — calls `clearAuth()` and redirects. Brief test asserting the call chain.

**Checkpoint**: All five user stories functional. The auth gate is in place.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T119 [P] Write `README.md` covering: setup, env vars (`ANTHROPIC_API_KEY`), `pnpm test` / `pnpm test:watch`, the architecture map from `quickstart.md`, the four constitution gates, and a time-spent estimate.
- [ ] T120 [P] Add `pnpm test:coverage` script and verify ≥ 80% line coverage on `lib/schemas`, `lib/store`, `lib/fetchers`, and `lib/hooks` (the four most-leveraged layers per the test pyramid).
- [ ] T121 Run `quickstart.md` end-to-end as documented validation — every step works in order with no missing setup.
- [ ] T122 Performance pass against SC-005 — seed 200 meetings, measure dashboard time-to-interactive; if > 1 s investigate `MeetingList` rendering and add windowing if needed.
- [ ] T123 [P] Add a CI workflow (`.github/workflows/ci.yml`) running `pnpm typecheck && pnpm lint && pnpm test`. Optional for the v1 demo, but cheap insurance.
- [ ] T124 Audit re-renders on the dashboard — confirm granular selectors are used everywhere and a `setFilter` does not re-render an unrelated `<MeetingCard>`. Fix any leak with selector tweaks (not memo hacks).
- [ ] T125 Final security pass — run the T024 grep manually one more time, confirm `ANTHROPIC_API_KEY` never appears in any client-side build artifact via `grep -r 'ANTHROPIC' .next/static 2>/dev/null` returning nothing.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies. Can start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1. **Blocks every user story.**
- **Phase 3 (US1)**: depends on Phase 2. Independent of US2–US5 in concept; the MVP.
- **Phase 4 (US2)**: depends on Phase 2. Independently testable once US1 supplies transcripts; can begin in parallel with US1 if a second developer is staffed and the seeded `meetings.seed.json` includes a meeting with a transcript.
- **Phase 5 (US3)**: depends on Phase 2 + the `claude.fetcher`/`prompts`/`claude.route` scaffolding from US2 (T067–T076). If US2 is happening in parallel, US3 starts after US2's foundational files (T067, T076) are merged.
- **Phase 6 (US4)**: depends on Phase 2 + US1 components (`MeetingList`, `MeetingCard`, `useMeetings`). Cleanest after US1 lands.
- **Phase 7 (US5)**: depends on Phase 2 only. Can run fully in parallel with US1–US4 because the protected layout is added at the end (T117) so other stories' dev/test workflows are unaffected.
- **Phase 8 (Polish)**: depends on all chosen user stories being complete.

### Within Each User Story (TDD layer order — non-negotiable)

For every story, tasks follow:

1. Schema test → schema implementation
2. Store test → store implementation (when the story extends Zustand)
3. Fetcher test → fetcher implementation
4. Hook test → hook implementation
5. Component test → component implementation
6. Route-handler test → route-handler implementation (when the story touches `app/api/`)

Tests inside a layer are `[P]` (different files). Implementations within a layer are `[P]` when they don't depend on each other. Layers themselves are sequential per the constitution.

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T005, T009, T010, T011, T012 can all run in parallel after T001 completes.
- **Phase 2**: T013, T015, T017, T018, T022, T024 run in parallel; their implementations (T014, T016, T019, T020, T023) follow.
- **Each user story**: all schema tests `[P]`, all hook tests `[P]`, all component tests `[P]`, all route tests `[P]`. The Implementation tasks generally follow sequentially within a layer because of cross-file imports (e.g. `useMeetings` imports `meetingKeys` and the fetcher).
- **Stories themselves**: with multiple developers, US1 + US5 are the cleanest parallel pair (US5 only touches `(auth)/`, `authStore`, and the layout). US2 + US3 share `claude.fetcher` and the route handler, so they parallelise only after their shared scaffolding lands.

---

## Parallel Example: User Story 1 schemas + store layer

```bash
# Schema tests in parallel:
Task: "Write __tests__/schemas/meeting.schema.test.ts"
Task: "Write __tests__/schemas/transcript.schema.test.ts"

# Once both fail with the expected red, implement in parallel:
Task: "Implement lib/schemas/meeting.schema.ts"
Task: "Implement lib/schemas/transcript.schema.ts"

# Move to the store layer — single file so not parallel:
Task: "Write __tests__/store/meetingStore.test.ts"
Task: "Implement lib/store/meetingStore.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational (CRITICAL — blocks every story)
3. Phase 3: User Story 1
4. **Stop. Validate.** Run the US1 independent test from `quickstart.md`. Demo.

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → MVP (capture + transcript)
3. + US2 → adds AI summaries
4. + US3 → adds action items
5. + US4 → adds filtering at scale
6. + US5 → adds the auth gate
7. + Polish

Each step is shippable. Each step preserves the previous step's tests.

### Parallel Team Strategy

With three developers and the foundational phase done:
- **Dev A**: US1 (the largest story).
- **Dev B**: US5 (smallest, totally independent — auth/login is isolated under `(auth)/` and `authStore`).
- **Dev C**: US2 scaffolding (T067, T076), then US3 once US2's scaffolding merges.

US4 lands after US1 wraps because it extends US1's `MeetingList` and `useMeetings`.

---

## Notes

- `[P]` tasks = different files, no dependency on a pending task in the same phase.
- `[Story]` label maps a task to a single user story; tasks without a label belong to Setup, Foundational, or Polish.
- Every test task MUST run and fail before its implementation task is started — `fireflies-tdd` gate.
- Mock at the network boundary (the fetcher) for hook tests, never at the hook boundary.
- Component tests query by role/label, never by `data-testid`. `userEvent` over `fireEvent`.
- Each store reset goes in `beforeEach`, not `beforeAll`.
- Commit after each task or logical group (e.g. one commit per layer per story).
- Stop at any phase checkpoint to validate the slice end-to-end before adding the next.
- Avoid: implementing before a failing test exists; importing `swr` outside `lib/hooks/`; inlining `@anthropic-ai/sdk` outside `app/api/claude/route.ts`; storing server data in Zustand.
