---

description: "Dependency-ordered, TDD-first task list for automatic transcription from recording"
---

# Tasks: Automatic Transcription from Recording

**Input**: Design documents from `/specs/002-recording-transcription/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/transcribe.md, quickstart.md

**Tests**: REQUIRED. The project's effective constitution (`fireflies-tdd`) is unchanged — every layer's failing test is written before the implementation that satisfies it. Layer order: **schema → fetcher → hook → component → route**. (For the API route specifically, we keep v1's pattern of writing the security gate before the route exists, then watching it stay green as the route lands.)

**Organization**: Tasks are grouped by user story (US1 → US3) so each story is independently testable and deployable. **US1 alone is the MVP** — it delivers a working speech-to-saved-transcript flow without the review-and-edit refinement (US2) or the failure fallback (US3).

**Scope discipline**: This is an additive feature on top of `001-fireflies-clone`. No v1 file is rewritten. `TranscriptEditor`, `useUpdateTranscript`, and the `/api/meetings/[id]` route are reused as-is. The single existing file that gains lines in this feature is `__tests__/security/api-key-isolation.test.ts` (extended with parallel OpenAI assertions) and `lib/hooks/useRecording.ts` (gains a `clearAudio` method).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on a pending task.
- **[Story]**: `[US1]`–`[US3]` for story-phase tasks; absent for Setup, Foundational, and Polish.
- File paths are absolute relative to repo root.

## Path Conventions

Single Next.js App Router project (see `plan.md` § Project Structure). Source under `app/`, `components/`, `lib/`. Tests under `__tests__/`. All paths below assume that root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new SDK and document the new env var. The project skeleton already exists from v1.

- [ ] T001 [P] Install the OpenAI Node SDK: `pnpm add openai@^4`. Verify it lands as a runtime dependency in `package.json` (not `devDependencies`).
- [ ] T002 [P] Extend `.env.example` with `OPENAI_API_KEY=` on a new line (no value). Add the same line, with explanatory comment, to the README's environment section if one exists.

**Checkpoint**: `pnpm install` is clean, `pnpm typecheck` and `pnpm lint` still pass, no test is broken by the new dependency.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build every layer the three user stories share — the request/response schema, the fetcher, the hook, the API route, and the key-isolation gate. Every layer is written test-first.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete.

### Schemas (TDD layer 1)

- [ ] T003 Write `__tests__/schemas/transcribe.schema.test.ts` — `transcribeRequestSchema` rejects empty `meetingId`, rejects missing `audio`, accepts `{ meetingId: 'mtg_x', audio: new File([new Blob(['x'])], 'recording.webm', { type: 'audio/webm' }) }`; `transcribeResponseSchema` rejects empty `transcript`, rejects negative `durationSeconds`, accepts a happy payload.
- [ ] T004 Implement `lib/schemas/transcribe.schema.ts` — export `transcribeRequestSchema`, `transcribeResponseSchema`, and the inferred TS types `TranscribeRequestInput`, `TranscribeResponse`. Use `z.instanceof(File)` for the `audio` field per `data-model.md`.

### Security gate (written early, lands green pre- and post-route)

- [ ] T005 Extend `__tests__/security/api-key-isolation.test.ts` with two parallel assertions matching v1's Anthropic checks: (a) `grep -rE "(from ['\"]openai['\"]|require\(['\"]openai['\"]\))" app components lib --include='*.ts' --include='*.tsx'` returns **at most one** file, and that file (if any) is `app/api/transcribe/route.ts`; (b) no env var name in `.env.example` starting with `NEXT_PUBLIC_` contains the substring `OPENAI`. Pre-route the count is `0`; post-route (T014) it becomes `1`. The "at most one" predicate keeps the test green throughout.

### Fetcher (TDD layer 2)

- [ ] T006 Write `__tests__/fetchers/transcribe.fetcher.test.ts` — mocks `global.fetch`. Asserts: (1) `transcribeAudio({ meetingId, audio })` builds a `FormData` with both fields and POSTs to `/api/transcribe` with no explicit `Content-Type` header (so the browser sets the multipart boundary); (2) a pre-flight reject fires when `audio.size > 25 * 1024 * 1024` — fetch is never called and the rejection has `kind: 'TOO_LARGE'`; (3) status mapping: 200 + valid body → resolves to the parsed response; 413 → `{ kind: 'TOO_LARGE' }`; 422 → `{ kind: 'NO_SPEECH' }`; 415 → `{ kind: 'PROVIDER' }` (mapped under the catch-all umbrella); 500 → `{ kind: 'PROVIDER' }`; `fetch` throwing → `{ kind: 'NETWORK' }`; (4) 200 with a body that fails `transcribeResponseSchema` → `{ kind: 'PROVIDER' }`.
- [ ] T007 Implement `lib/fetchers/transcribe.fetcher.ts` — exports `transcribeAudio(input)` (returns `Promise<TranscribeResponse>`, throws `TranscriptionError`), the `TranscriptionError` discriminated union, and the `MAX_AUDIO_BYTES = 25 * 1024 * 1024` constant. No React, no SWR imports. Defense-in-depth re-validates the response body with `transcribeResponseSchema`.

### Hook (TDD layer 3)

- [ ] T008 Write `__tests__/hooks/useTranscribeRecording.test.tsx` — wraps in `createTestWrapper()` from `__tests__/utils/wrapper.tsx`, mocks `@/lib/fetchers/transcribe.fetcher`. Asserts: (1) initial state has `isMutating: false`, `data: undefined`, `error: undefined`; (2) calling `trigger(blob)` flips `isMutating` to `true` then resolves with the fetcher's result; (3) on fetcher rejection, `error` is the typed `TranscriptionError`; (4) the result is **not** cached against any SWR key (a second `trigger` call always re-invokes the fetcher).
- [ ] T009 Implement `lib/hooks/useTranscribeRecording.ts` — `useSWRMutation(['transcribe', meetingId], (_, { arg }) => transcribeAudio({ meetingId, audio: arg }))`. The key is synthetic and not used for caching; `useSWRMutation` is the right primitive because it gives us `trigger`, `isMutating`, `data`, and `error` for free. Returns the mutation handle plus a `reset()` helper that calls `mutate(undefined, false)` to clear `data` and `error`.

### Audio lifecycle (extension to existing v1 hook)

- [ ] T010 Write `__tests__/hooks/useRecording.test.tsx` (or extend the existing file if present) — assert that `clearAudio()` sets `audioBlob` back to `null` and empties `chunksRef`; assert that after `start() → stop() → clearAudio()`, a second `start() → stop()` produces a *new* `audioBlob` that is not reference-equal to the first.
- [ ] T011 Extend `lib/hooks/useRecording.ts` — add a `clearAudio` method to `UseRecordingReturn` that calls `setAudioBlob(null)` and `chunksRef.current = []`. Keep the existing signature backwards-compatible.

### API route (TDD layer 4)

- [ ] T012 Write `__tests__/api/transcribe.route.test.ts` — implement the **seven** contract tests enumerated in `contracts/transcribe.md`: happy path returns 200 + valid body + `X-Meeting-Id` header; missing `meetingId` → 400; missing `audio` → 400; oversize `audio` → 413; unsupported MIME → 415; SDK returns `{ text: '   ' }` → 422 `"No speech detected"`; SDK rejects → 500 `"Transcription failed"`. Drive assertions via `jest.mock('openai', () => ({ default: class { audio = { transcriptions: { create: jest.fn() } } } }))`.
- [ ] T013 Wire the route's accept list of MIME types (`audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, `audio/m4a`, `audio/mp3`) into a `SUPPORTED_AUDIO_MIME` constant inside `app/api/transcribe/route.ts` (this constant is referenced by both T012 and T013 — write T012's test first, then implement T013 to satisfy it).
- [ ] T014 Implement `app/api/transcribe/route.ts` — `export const runtime = 'nodejs'`; reads `process.env.OPENAI_API_KEY` directly; pins `const MODEL = 'whisper-1'`; parses `req.formData()`; runs presence / size / MIME checks (returning 400 / 413 / 415 with the documented envelopes); constructs a `File` from the multipart `Blob` and passes it to `client.audio.transcriptions.create({ file, model: MODEL })`; trims the returned text and returns 422 if empty, 500 if the SDK rejects, 200 with `{ transcript, durationSeconds }` otherwise. This is the only file in the repo that may `import OpenAI from 'openai'` — verified by T005.

### Cache-key factory extension (no caching, but the key shape is registered)

- [ ] T015 Extend `__tests__/schemas/cacheKeys.test.ts` (existing v1 file) with one assertion: `meetingKeys.transcribe(meetingId)` returns the tuple `['meetings', 'detail', meetingId, 'transcribe'] as const`. Then add the corresponding `transcribe(id)` member to `lib/api/cacheKeys.ts`. The hook from T009 uses this key, not a raw string. Even though `useSWRMutation` does not cache the result, the key participates in the factory's namespace so it cannot accidentally collide with a future query key.

**Checkpoint**: `pnpm test` runs T003, T006, T008, T010, T012, T015 plus the extended T005, all green. `pnpm typecheck` clean. `pnpm lint` clean. Foundation ready — user-story work can begin.

---

## Phase 3: User Story 1 — Auto-transcribe on stop (Priority: P1) 🎯 MVP

**Goal**: When the user stops a recording, the audio is uploaded to `/api/transcribe`, the produced text is written to the meeting via the existing `useUpdateTranscript` mutation, and the meeting detail page renders the new transcript — no manual paste required. A "replace existing transcript?" confirm is shown if the meeting already has one.

**Independent Test**: From an empty meeting, open it, click **Start recording**, speak for a few seconds, click **Stop**. The in-progress indicator appears, then within ~15 s the transcript text is visible on the page and persists across a full reload. Repeat on a meeting that already has a transcript: the **Replace?** dialog appears before the new transcript is saved.

### Components (TDD layer 5)

- [ ] T016 [US1] Write `__tests__/components/TranscriptionReview.test.tsx` — happy-path cases. (1) When `useRecording().audioBlob` transitions from `null → Blob`, the component fires the `useTranscribeRecording` trigger exactly once with that blob; (2) while `isMutating`, the component renders a visible in-progress indicator with `role="status"`; (3) on `data` arriving, the component invokes `useUpdateTranscript(meetingId).trigger(producedText)` exactly once and then calls `useRecording().clearAudio()`; (4) when the meeting already has a non-empty `transcript`, the component shows an `AlertDialog` with **Replace** and **Keep current** actions *before* firing the upload, and the upload only fires on **Replace**; (5) re-mounting the page after a successful save does **not** re-fire transcription (gated on `audioBlob === null && transcript !== null`).
- [ ] T017 [US1] Implement `components/transcript/TranscriptionReview.tsx` (`'use client'`) — composes `useRecording`, `useTranscribeRecording`, `useUpdateTranscript`, and `useMeeting(meetingId)`. Effect: on `audioBlob` change, run the replace-confirm if necessary, then trigger the upload, then on success run the transcript mutation, then call `clearAudio()`. Renders the in-progress indicator while `isMutating`. Renders nothing once the transcript is saved (the existing `TranscriptView` on the detail page takes over).
- [ ] T018 [US1] Add a focused unit test `__tests__/components/TranscriptionReview.replace.test.tsx` covering only the replace-confirm dialog interactions (open, Replace → upload fires; Keep current → upload does **not** fire and the blob is cleared). Kept in a separate file because the dialog's user-event mocking is verbose and would dwarf the happy-path file.

### Page wiring

- [ ] T019 [US1] Modify `app/(dashboard)/meetings/[id]/page.tsx` to mount `<TranscriptionReview meetingId={id} />` above the existing `<RecordingControls />` / `<TranscriptEditor />` block. The existing `TranscriptEditor` direct mount is **kept** as the fallback / manual surface — US3 wires it up explicitly to the failure state, but for US1 the editor remains where it is for the manual-replace path. (No edits to `TranscriptEditor.tsx` itself in US1.)
- [ ] T020 [US1] Add a Cypress-free integration test `__tests__/components/meeting-detail.transcription.test.tsx` that renders the meeting detail page with mocked SWR data and a mocked `transcribeAudio` fetcher; simulates `start → stop` via the `useRecording` hook's exposed setters; asserts the rendered DOM transitions through `indicator visible → indicator gone → transcript text visible` and that the underlying `PATCH /api/meetings/[id]` was called with the produced text. This exercises wiring without booting Next.js.

**Checkpoint**: US1 ships. A user records a meeting and sees the saved transcript without ever touching the textarea. Pressing record again on a meeting with a transcript prompts before replacing.

---

## Phase 4: User Story 2 — Review and edit before final (Priority: P2)

**Goal**: The auto-generated text is presented in `TranscriptEditor` for review **before** it is committed to the meeting. The user may edit and save (edits persist); or discard (no auto-text is silently retained). Downstream summary and action-item flows operate on the user-confirmed transcript, not the raw produced one.

**Independent Test**: After an auto-transcription completes, the editor is visible with the produced text pre-filled. Edit a single word, click **Save transcript**, reload — the edit persists. Repeat without saving (navigate away or refresh) — the meeting reverts to no transcript.

### Refactor TranscriptionReview to require user confirmation

- [ ] T021 [US2] Update `__tests__/components/TranscriptionReview.test.tsx` (or add an opposing test file) — **invert** the auto-save assertion from US1: the component must **not** call `useUpdateTranscript.trigger` automatically on `data` arrival; instead, it must mount `<TranscriptEditor initialValue={producedText} onSaved={onSaved} />` and `onSaved` is what calls `clearAudio()`. The discard path (the user navigates away by unmounting) leaves the meeting's transcript untouched. This task supersedes the US1 happy-path assertion T016 (4).
- [ ] T022 [US2] Update `components/transcript/TranscriptionReview.tsx` accordingly — replace the direct mutation call with a render of `<TranscriptEditor initialValue={producedText} onSaved={() => clearAudio()} />`. The replace-confirm from US1 stays in place (it gates whether the auto path even runs). The existing `TranscriptEditor` is **not modified** — it already accepts `initialValue` from v1.
- [ ] T023 [US2] Write `__tests__/components/transcript-edit-roundtrip.test.tsx` — full editor round-trip test: mount the meeting detail page with mocks, run the auto path, edit one character in the textarea, click Save, assert that `useUpdateTranscript.trigger` is called with the *edited* string (not the original `producedText`).
- [ ] T024 [US2] Write `__tests__/components/transcript-downstream.test.tsx` — verify the AI consumers: render `<SummaryView meetingId={id} />` and `<ActionItems meetingId={id} />` after a meeting transcript was confirmed via the auto + review flow. Mock `useSummary` / `useActionItems` and assert that the prompt-input transcript they receive is the user-edited value, not the auto-produced draft. (This is a regression guard — these hooks already do the right thing in v1; the test pins it.)

**Checkpoint**: US2 ships. The editor is the gate. No transcript is committed without a user click. Edits flow into the downstream AI features unchanged.

---

## Phase 5: User Story 3 — Graceful failure fallback (Priority: P3)

**Goal**: Every transcription failure surfaces a `TranscriptionFallback` with three affordances — **Retry**, **Enter manually**, **Re-record** — and the manual path saves a transcript with the same guarantees the v1 flow had. Specific failure kinds hide the affordances that cannot succeed (Retry hidden for `TOO_LARGE` and `NO_SPEECH`).

**Independent Test**: Force a failure (set `OPENAI_API_KEY=invalid` or send a 30 MB recording). Observe the fallback panel. **Enter manually** opens an empty `TranscriptEditor`; typing a transcript and saving persists it. **Re-record** returns to the recording controls. **Retry** re-runs the upload with the same blob (when the kind permits).

### TranscriptionFallback component

- [ ] T025 [US3] Write `__tests__/components/TranscriptionFallback.test.tsx` — one `describe.each` per `TranscriptionError.kind`: (1) `NETWORK` → renders Retry + Enter manually + Re-record; (2) `TOO_LARGE` → renders Enter manually + Re-record (no Retry); (3) `NO_SPEECH` → renders Enter manually + Re-record (no Retry); (4) `PROVIDER` → renders all three. Each variant also asserts the human-readable copy contains the appropriate message ("Could not transcribe", "Recording is too long", "No speech detected", "Transcription failed").
- [ ] T026 [US3] Implement `components/transcript/TranscriptionFallback.tsx` (`'use client'`) — pure presentational. Props: `error: TranscriptionError`, `onRetry: () => void`, `onManual: () => void`, `onReRecord: () => void`. Renders an alert region (`role="alert"`) with the right copy and the three buttons; conditionally hides Retry per the table above. No state of its own.

### Integrate the fallback into TranscriptionReview

- [ ] T027 [US3] Extend `__tests__/components/TranscriptionReview.test.tsx` (or a sibling file) — when `useTranscribeRecording().error` is set, render `<TranscriptionFallback>` instead of the editor; clicking Retry re-fires `trigger(audioBlob)`; clicking Enter manually clears the blob and shows `<TranscriptEditor initialValue="" />`; clicking Re-record clears the blob and returns the recording controls to `idle` (verified by asserting `useRecording().status === 'idle'`).
- [ ] T028 [US3] Update `components/transcript/TranscriptionReview.tsx` to render `<TranscriptionFallback>` whenever the mutation has an error. Map the three buttons to the local handlers described in T027. Preserve the in-progress and review branches from US1/US2.
- [ ] T029 [US3] Pre-flight oversize guard — add `__tests__/components/TranscriptionReview.preflight.test.tsx`: when the audio blob exceeds 25 MB at stop-time, the fetcher pre-flight rejection (T006 case 2) bubbles up; `TranscriptionReview` shows the fallback with `kind: 'TOO_LARGE'` without ever calling `fetch`. The relevant logic already lives in the fetcher; this test pins it at the component layer.
- [ ] T030 [US3] No-speech path — add a focused test `__tests__/components/TranscriptionReview.nospeech.test.tsx` that mocks the fetcher to reject with `{ kind: 'NO_SPEECH' }` and asserts the fallback's "No speech detected" copy is shown, **Retry** is hidden, and **Enter manually** clears the blob and opens an empty editor.
- [ ] T031 [US3] Sanity-check the manual fallback path — write `__tests__/components/manual-fallback-roundtrip.test.tsx` that, starting from a `NETWORK` failure, clicks **Enter manually**, types a transcript into the now-empty editor, clicks Save, and asserts `useUpdateTranscript.trigger` was called with the typed string. This pins SC-004's "no dead-end failure" guarantee.

**Checkpoint**: US3 ships. Every failure surface has retry+manual on the same screen. The original v1 manual flow is intact and one click away.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Bring the feature over the merge line.

- [ ] T032 [P] Run `pnpm test --coverage` and confirm the new files inherit v1's coverage thresholds — fail the build if `lib/fetchers/transcribe.fetcher.ts`, `lib/hooks/useTranscribeRecording.ts`, `app/api/transcribe/route.ts`, or `components/transcript/TranscriptionReview.tsx` are below the existing per-folder thresholds.
- [ ] T033 [P] Update `README.md` to add `OPENAI_API_KEY` to the environment-variable list with a one-sentence note ("server-only, used by `/api/transcribe`; never set `NEXT_PUBLIC_OPENAI*`"). Cross-reference the contracts doc.
- [ ] T034 [P] Update the project's `Time spent` / changelog block in `README.md` if such a block exists, noting the addition of automatic transcription.
- [ ] T035 Run the quickstart smoke check (`specs/002-recording-transcription/quickstart.md` § Smoke check) end-to-end in a real browser: happy path, oversize rejection, invalid-key fallback. Note any drift in `quickstart.md`'s troubleshooting table.
- [ ] T036 Final security pass — execute `pnpm test -- api-key-isolation` and visually inspect that exactly one file imports `openai` (the route) and exactly one file imports `@anthropic-ai/sdk` (the v1 claude route). Diff the test output against the v1 baseline to make sure nothing regressed.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** — no dependencies; runs first.
- **Foundational (Phase 2)** — depends on Setup; **blocks all user stories**.
- **US1 (Phase 3)** — depends only on Foundational.
- **US2 (Phase 4)** — depends on US1 (it modifies `TranscriptionReview`'s flow from "auto-save" to "review then save").
- **US3 (Phase 5)** — depends on US1 (it adds a third branch to `TranscriptionReview`'s render). Independent of US2 in source terms, but typically shipped after US2 because the editor wiring is the same touchpoint.
- **Polish (Phase 6)** — depends on whichever stories are in scope for the release.

### Layer order within each story

- Tests first, in the layer order **schema → fetcher → hook → component → route**.
- For US1–US3, only the **component** layer is touched (Foundational already covered the lower layers). Test → impl → integration test.

### Parallelizable tasks

- **Phase 1**: T001 and T002 are independent (`[P]` on both).
- **Phase 2**: tests within a layer can be authored in parallel if a team has the bandwidth, but within a single developer, follow the layer order strictly. T015 (cache-key factory extension) is independent of everything else and `[P]`-able with any other phase-2 task.
- **Phase 6**: T032, T033, T034 are `[P]`-able.

### Story-internal dependencies

- **US1**: T016 → T017 → T018; T019 depends on T017; T020 depends on T017+T019.
- **US2**: T021 → T022; T023 and T024 are `[P]` once T022 lands.
- **US3**: T025 → T026 (fallback component); T027 → T028 (orchestrator integration); T029, T030, T031 are `[P]` once T028 lands.

---

## Parallel Example: Phase 2 foundation

```bash
# A single dev runs sequentially; a pair can split like this once each layer's test exists:
# Dev A: schema layer (T003, T004), then fetcher layer (T006, T007)
# Dev B: security gate (T005), then hook test scaffolding (T008)
# After T007 lands:
# Dev A: implement hook (T009)
# Dev B: write route contract tests (T012)
# After T009:
# Dev A: useRecording extension (T010, T011)
# Dev B: implement route (T013, T014)
# T015 (cache-key extension) can slot in anywhere it fits.
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Complete Phase 1: Setup (2 tasks)
2. Complete Phase 2: Foundational (13 tasks) — **blocks US1**
3. Complete Phase 3: US1 (5 tasks)
4. **STOP and VALIDATE**: smoke-test the happy path in a real browser per the quickstart.
5. Ship. The product now auto-transcribes recordings end-to-end. The downstream summary/action-items work unchanged.

### Incremental delivery

1. MVP (above) — ships the headline outcome.
2. Add US2 (4 tasks) — adds the review-and-edit gate. The transcript is no longer committed without a user click.
3. Add US3 (7 tasks) — adds the failure fallback. No dead-end errors.
4. Polish (5 tasks) — merge.

### Parallel team strategy

With two developers after Phase 2 lands:

- Dev A: US1 (T016 → T020)
- Dev B: stays on US3's `TranscriptionFallback` (T025 → T026) — it is a pure presentational component, can be written in isolation before being wired up.
- Once US1 lands: Dev A pivots to US2; Dev B integrates US3 into `TranscriptionReview` (T027 → T031).

---

## Notes

- Every test in this list is a real assertion against a real behaviour described in the spec or contracts; there are no decorative tests. Each one would fail before its implementation lands.
- The `[P]` marker is conservative: it never marks two tasks that touch the same file.
- The feature is **additive** — every v1 file referenced here is read, not modified, except for `__tests__/security/api-key-isolation.test.ts` (T005), `lib/hooks/useRecording.ts` (T011), `lib/api/cacheKeys.ts` (T015), `app/(dashboard)/meetings/[id]/page.tsx` (T019), and `README.md` (T033, T034). Diffs against v1 stay small.
- Layer order is non-negotiable — a hook impl with no failing hook test, or a route impl with no contract test, is a constitution-gate violation, not a style preference.
- Commit after each layer, not each task. A logical group is "test + impl that turns it green" — that is what gets the commit message and what gets reviewed.
