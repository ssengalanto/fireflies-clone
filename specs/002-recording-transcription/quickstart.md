# Quickstart: Automatic Transcription from Recording

This guide explains how to bring up the development environment for feature `002-recording-transcription`, the TDD loop, and the common failure modes you will hit while building it. It assumes the v1 quickstart (`specs/001-fireflies-clone/quickstart.md`) has already been followed and the project is runnable as today.

## What is new in this feature

You will add:

- One new server route: `app/api/transcribe/route.ts` (the only file allowed to import `openai`)
- One new schema: `lib/schemas/transcribe.schema.ts`
- One new fetcher: `lib/fetchers/transcribe.fetcher.ts`
- One new hook: `lib/hooks/useTranscribeRecording.ts`
- Two new components: `components/transcript/TranscriptionReview.tsx`, `components/transcript/TranscriptionFallback.tsx`
- One existing security test gains parallel assertions: `__tests__/security/api-key-isolation.test.ts`

You will **not** modify:

- The `Meeting`, `Transcript`, `Summary`, or `ActionItem` schemas
- `useUpdateTranscript` or `TranscriptEditor` (the editor will simply be passed a non-empty `initialValue` from the new orchestrator)
- `app/api/claude/route.ts` or anything under the Anthropic side of the codebase

## Environment

Add a single environment variable to `.env.local`:

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...      # already present from v1
OPENAI_API_KEY=sk-...             # NEW — used only by app/api/transcribe/route.ts
```

The `.env.local.example` file gains a placeholder line so future contributors know it is required.

**Do not** prefix this var with `NEXT_PUBLIC_`. The security test will fail merge if you do.

## Dev loop

```bash
pnpm dev              # starts Next.js — same as v1
pnpm test --watch     # the TDD loop you'll actually live in
pnpm test:coverage    # the gate CI runs
```

Per `fireflies-tdd`: write the failing test first, in the order **schema → fetcher → hook → component**, and never let an implementation file exist without its test going first.

## Order of work (the TDD ladder for this feature)

The order below is what `/speckit-tasks` will encode into `tasks.md`. Follow it strictly.

1. **`__tests__/schemas/transcribe.schema.test.ts`** — write the failing test for `transcribeRequestSchema` and `transcribeResponseSchema`. Then write `lib/schemas/transcribe.schema.ts`. Green.
2. **`__tests__/security/api-key-isolation.test.ts`** — extend the existing security test with the two new assertions (one-file `openai` import + no `NEXT_PUBLIC_OPENAI*`). Watch it fail. Skip ahead to step 3 to get a file to satisfy the grep, but **do not** add the `import` until step 3's tests demand it.
3. **`__tests__/api/transcribe.route.test.ts`** — write the seven contract tests from `contracts/transcribe.md`. They will all fail (no route exists). Implement `app/api/transcribe/route.ts` with `jest.mock('openai', ...)` driving the assertions. Watch the security test from step 2 also turn green.
4. **`__tests__/fetchers/transcribe.fetcher.test.ts`** — write the failing test for `transcribeAudio` (FormData built, 25 MB pre-flight cap, status → `TranscriptionError.kind` mapping). Implement `lib/fetchers/transcribe.fetcher.ts`. Green.
5. **`__tests__/hooks/useTranscribeRecording.test.tsx`** — write the failing test for `useTranscribeRecording` (mocks the fetcher; asserts `isMutating`, `data`, and the typed error path). Implement `lib/hooks/useTranscribeRecording.ts`. Green.
6. **`__tests__/components/TranscriptionFallback.test.tsx`** — write the failing tests for each error kind (which buttons render for `NETWORK` / `TOO_LARGE` / `NO_SPEECH` / `PROVIDER`). Implement `components/transcript/TranscriptionFallback.tsx`. Green.
7. **`__tests__/components/TranscriptionReview.test.tsx`** — write the failing tests for the orchestrator: auto path runs after `stop`, produced text is passed to `TranscriptEditor` as `initialValue`, replace-confirm appears when meeting already has a transcript, audio is cleared after settle. Implement `components/transcript/TranscriptionReview.tsx`. Green.
8. **Wire `TranscriptionReview` into the meeting detail page** in place of (or above) the v1 `TranscriptEditor` direct mount. Verify by running `pnpm dev` and exercising the happy path in the browser.

## Smoke check in the browser

After step 8:

1. `pnpm dev` and sign in (existing v1 flow).
2. Create a new meeting, open it, hit **Start recording**, speak for ~30 seconds, **Stop**.
3. Confirm:
   - The in-progress indicator appears immediately on stop.
   - The transcript editor is populated with the produced text within ~15 seconds.
   - Edit a single word, click **Save transcript**, reload — your edit persists.
4. Force a failure: temporarily set `OPENAI_API_KEY=invalid` in `.env.local`, restart `pnpm dev`, stop a recording, and confirm:
   - The `TranscriptionFallback` is shown with **Retry**, **Enter manually**, **Re-record**.
   - **Enter manually** opens an empty `TranscriptEditor` and the v1 manual flow still works end-to-end.

## Common pitfalls (from the research notes)

| Symptom | Likely cause | Fix |
|---|---|---|
| Security test fails: "`openai` imported in more than one file" | Helper file imported the SDK type-only and got picked up by the grep | Either keep types in a `// types only` import block or move the helper into `route.ts`. Type-only imports are caught by the grep too — use the centralised re-export pattern from `app/api/transcribe/route.ts`. |
| `MediaRecorder is not a constructor` in a test | The jsdom polyfill from v1 wasn't loaded in this test file | Confirm `jest.setup.ts` is referenced in `jest.config.ts` and that the test file does not opt out of `testEnvironmentOptions`. |
| Pre-flight 25 MB check fires on a short recording | Some browsers buffer the entire recording on `stop()` rather than chunking — the Blob is the full file, which is correct. If it is firing on a *short* recording the cap is misconfigured. | The constant lives in `lib/fetchers/transcribe.fetcher.ts` — confirm it reads `25 * 1024 * 1024`, not `25 * 1024`. |
| Safari sends `audio/mp4` but the test mocks `audio/webm` | Mime types differ by browser. The route's accept list includes both. | Update the test to parameterise across both mime types if you want to assert end-to-end on Safari behaviour. |
| `useTranscribeRecording` retains the produced text after a re-record | The orchestrator did not call `mutate(undefined)` (or equivalent) before triggering the next run | Reset the mutation state explicitly when the recording transitions from `stopped` back to `idle`. |

## Done check

Before opening the PR, run:

```bash
pnpm test --coverage
pnpm lint
pnpm typecheck
```

All three must be green. The coverage gate from v1 still applies — the new files inherit the existing thresholds. The security test is part of `pnpm test` and is blocking for merge.
