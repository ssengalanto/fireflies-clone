# Submission notes

## What was built

A local-first, single-user meeting capture app modelled on Fireflies.ai, delivered in two features:

1. **Baseline (`specs/001-fireflies-clone/`)** — record audio in the browser, supply a transcript, then have Claude produce a streaming summary and a structured list of action items. Includes meeting CRUD, filtering/pagination, and a soft auth gate.
2. **Automatic transcription (`specs/002-recording-transcription/`)** — replaces the manual-paste step with an automatic speech-to-text pass using OpenAI's Whisper (`whisper-1`). The produced text lands in an editable review surface; failures degrade gracefully to retry, manual-entry, or re-record.

Stack: Next.js 14 (App Router, both UI and API in one project), TypeScript, SWR for server state, Zustand for UI state, react-hook-form + zod for forms, Tailwind + shadcn/ui for styling, Jest + Testing Library for tests, pnpm.

Final shape:

- **52 test suites, 308 tests passing.** New files added in feature 002 are at 96–100% line coverage; per-folder thresholds enforced for `lib/schemas`, `lib/store`, `lib/fetchers`, `lib/hooks`.
- **TDD throughout**, in the strict layer order `schema → store → fetcher → hook → component → route`. Every implementation file has a failing test that landed first.
- **Two AI SDKs, two import sites.** `@anthropic-ai/sdk` is imported only by `app/api/claude/route.ts`; `openai` is imported only by `app/api/transcribe/route.ts`. A static security test greps the source tree on every CI run and fails the build if either invariant is violated.
- The full architectural map lives in [`README.md`](README.md). The detailed specs, design plans, research logs, and task lists are under `specs/{001,002}/`.

## Notes on the thought process

A few decisions are worth surfacing because they aren't obvious from the code alone.

### 1. Speckit-driven workflow over "just code it"

Every feature went through `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → execution. The artifacts in `specs/{001,002}/` (spec, plan, research, data-model, contracts, quickstart, tasks) are the load-bearing documents — code follows from them, not the other way around. The benefits I cared about:

- Decisions live in `research.md` with a **Decision / Rationale / Alternatives** triple. Anyone reading later can challenge the call without re-discovering the constraints.
- `tasks.md` encodes the dependency graph as a checklist, so progress is mechanical rather than vibes-based.
- The spec is technology-agnostic. The plan is where the stack decisions surface. This keeps the spec stable as the stack churns.

### 2. TDD with a fixed layer order

Tests are written **before** implementation, ordered `schema → fetcher → hook → component → route`. This is more rigid than typical TDD discipline; the payoff is that each layer's contract is described by its tests, not by reading the implementation. When something breaks, the failing test names point at exactly which contract was violated.

The four `fireflies-*` skills under `.claude/skills/` encode the project's conventions (TDD ordering, SWR vs Zustand split, form chain, Anthropic key isolation). They make the constitution concrete enough that violations show up as test failures, not stylistic disagreements.

### 3. Two AI vendors, one rule

When automatic transcription was added, the natural temptation was to fold it into the existing `/api/claude` route. I rejected it for one reason: the strongest guarantee I have against accidental API-key leaks is "exactly one file imports vendor SDK X." Mixing both SDKs into one route would dilute that gate.

So `app/api/transcribe/route.ts` is a sibling of `app/api/claude/route.ts` rather than a fold-in. They share the *pattern* (server-only key, defensive parser server-side, single-file SDK import verified in CI), not the *code*. The security test asserts both rules in parallel.

### 4. Whisper's "Bye." problem

Whisper hallucinates short stock phrases on silent audio — "Bye.", "Thanks for watching!", "you", "[Music]". The naive "empty text → no speech" check let those through and would have silently saved fake transcripts. The fix uses Whisper's own `no_speech_prob` field from the `verbose_json` response: if every segment has `no_speech_prob > 0.6`, we return `422 No speech detected` regardless of what `text` says. Caught during the in-browser smoke test and fixed before submission. Documented in [`specs/002-recording-transcription/research.md`](specs/002-recording-transcription/research.md) R-008.

### 5. Audio is transient by construction

Recorded audio lives only in `useRecording`'s component state and as the multipart payload of one POST to `/api/transcribe`. After the transcript is produced (or the attempt is abandoned), the `Blob` reference is dropped via `clearAudio()`. The server doesn't persist audio at any layer. The product never builds an audio archive. This is FR-015 / SC-007 in the spec, and it's verifiable by inspecting client-side state after a flow completes.

### 6. The manual-paste path stays first-class

When feature 002 added auto-transcription, I didn't remove the manual `TranscriptEditor`. It survives in two roles: (a) the editable review pass for auto-produced text (which is now its primary use), and (b) the fallback affordance reachable from every failure surface (`TranscriptionFallback`'s "Enter manually" button). The result is that **no failure terminates in a dead-end state** — there is always a one-click path to a usable transcript. This is SC-004 in the feature-002 spec.

### 7. Known caveats for the reviewer

- **Meeting persistence is in-memory.** `lib/server/meetingStore.ts` is a `Map` seeded from `data/meetings.seed.json` on cold start. On a serverless deployment (Vercel) this means user-created meetings may not survive cold starts. The seed meetings always reappear, so the AI flow is reviewable end-to-end. The seam to swap in Vercel KV / Postgres / SQLite is `lib/server/meetingStore.ts` alone — nothing else needs to change.
- **No real authentication.** `/api/auth/login` accepts any valid email + password ≥ 6 chars and stores the session in `authStore` (Zustand persist). It's a soft gate so the dashboard has a landing page; the swap-in seam for a real IdP is the login route and `authStore`.
- **Transcription is batch, not live.** The audio is uploaded after the user stops the recording; there's no live captioning during capture. Live partials would require a different provider (Deepgram, AssemblyAI) — researched and rejected for scope reasons in `specs/002-recording-transcription/research.md` R-001 and R-004.
- **Vercel Hobby has a 4.5 MB request body cap** that's tighter than Whisper's 25 MB. On the free tier this caps usable recordings to roughly 25 minutes of opus audio. The README's Limitations section covers this.

### 8. AI assistance disclosure

This work was AI-paired using Claude Code throughout. The split of responsibility was deliberate; both halves are visible in the repo.

The **human role** covered the load-bearing decisions:

- **Spec design via a directing prompt.** I authored the structured brief that drove Speckit, not the spec text itself. For feature 001 the brief is preserved verbatim at [`specs/001-fireflies-clone/original-prompt.md`](specs/001-fireflies-clone/original-prompt.md) — it pins the stack, the project structure, the SWR-vs-Zustand split, the form chain, the Claude key-isolation rule, the recording model, the TDD layer order, the persist/partialize rules, the test-wrapper patterns, and even the README requirements. For feature 002 the brief was a one-line `/speckit-specify` argument that re-scoped automatic transcription from "out of scope in v1" to "build it as a sibling layer on top of 001". Speckit + Claude expanded each brief into the per-feature `spec.md` / `plan.md` / `research.md` / `data-model.md` / `contracts/` / `tasks.md`. My job at each Speckit phase (`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`) was to read the generated artifact and either accept, redirect, or rewrite it — every [NEEDS CLARIFICATION] marker, every priority order, every user-story acceptance scenario was a checkpoint I validated before the workflow advanced.
- **Architectural decisions.** Choice of stack (Next.js App Router + SWR + Zustand + react-hook-form + zod + Tailwind + shadcn/ui). The SWR-owns-server-state / Zustand-owns-UI-state split. The `schema → store → fetcher → hook → component → route` TDD layer order. The "exactly one file imports vendor SDK X" key-isolation rule. The decision to add `/api/transcribe` as a sibling route rather than fold it into `/api/claude`. The decision to keep the manual-paste path as a first-class fallback rather than delete it after auto-transcription shipped. The 25 MB pre-flight cap with both client and server enforcement. The `no_speech_prob > 0.6` per-segment threshold for the silence check.
- **UI/UX direction.** Set the visual language to a tech-utility aesthetic — terse hierarchy with an `eyebrow` label above every heading, a three-tier text-color palette (`fg`, `fg-2`, `fg-3`, `fg-muted`), thin `hairline` dividers, named status atoms (`record-dot`, `streaming-cursor`, `skeleton-shimmer`), staggered `reveal reveal-N` entry animations, and named button intents (`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`). The component-level execution was delegated to Claude Code's `frontend-design` plugin (`.claude/plugins/frontend-design`), which is purpose-built to produce distinctive interfaces rather than the generic AI-styled output the default agent tends toward. My direction was the brief; the plugin generated the components; I reviewed and rejected/redirected against the language until the surface read consistent end to end.
- **Per-layer code review and validation.** Every generated layer was read before the next layer was written. Because tests landed first, I verified that each test exercised the right contract (and not an accidental detail of the implementation underneath) before accepting the implementation it gated. Catching a poorly-aimed test costs minutes; catching it three layers later costs hours.
- **Catching what the AI agent missed.** The Whisper "Bye." hallucination on silent audio — found in the in-browser smoke test, traced to `no_speech_prob`, fixed via the `> 0.6` per-segment threshold. The duplicate "Step 2" UI on the meeting detail page after the US2 refactor — root-caused to the unconditional standalone editor on the page, fixed with a one-line guard. The Vercel deployment caveats — in-memory meeting store, 4.5 MB body cap on Hobby — neither would have surfaced without me thinking through the runtime.

The **AI agent's role** was the typing: drafting tests under direction at each layer, drafting implementations to make those tests pass, drafting the supporting docs (`research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `tasks.md`). The conventions that kept it on rails — the four `fireflies-*` skills under `.claude/skills/`, the Speckit workflow itself — are themselves authored artifacts; they encode how I want this repo to be built, and they're checked into the project so the discipline is reproducible across sessions.

Total wall-clock effort, derived from git history: ~6.5 hours for both features combined (`~5 h` for feature 001, `~1.5 h` for feature 002), against an estimate of ~41 h for a single developer to run the same plan by hand. The README's "Time estimate" and "Actual time spent" sections break this down by phase.

## Where to look first

- [`README.md`](README.md) — the architecture map, the four constitutional gates, and end-to-end traces of the streaming-summary and auto-transcription flows
- [`specs/001-fireflies-clone/spec.md`](specs/001-fireflies-clone/spec.md) and [`specs/002-recording-transcription/spec.md`](specs/002-recording-transcription/spec.md) — what was built and why
- [`specs/001-fireflies-clone/plan.md`](specs/001-fireflies-clone/plan.md) and [`specs/002-recording-transcription/plan.md`](specs/002-recording-transcription/plan.md) — the stack and structural decisions, with the constitution-check table
- `pnpm test` — 52 suites, 308 tests should pass against a clean `pnpm install`
