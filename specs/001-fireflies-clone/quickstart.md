# Quickstart: Fireflies Clone

Setup, run, and develop the Fireflies clone locally. Pairs with `plan.md` (the architectural map), `data-model.md` (the entities), and `contracts/` (the API surface).

## Prerequisites

- **Node.js 20+** (Next.js 14 minimum runtime)
- **pnpm 8+** (preferred — the `tasks.md` scripts assume `pnpm`; `npm` works if you adapt the commands)
- **An Anthropic API key** with access to `claude-opus-4-7`. The key never reaches the browser.

## Initial setup

```bash
# 1. install dependencies
pnpm install

# 2. set up environment variables — see "Environment" below
cp .env.example .env.local
# then edit .env.local and fill in ANTHROPIC_API_KEY

# 3. (optional) seed some dev meetings
# data/meetings.seed.json is read once by lib/server/meetingStore.ts on cold start
# the repo ships with a small sample set; replace or empty as you like
```

## Environment

| Variable | Required | Where it's read | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | `app/api/claude/route.ts` only | **NEVER** prefix with `NEXT_PUBLIC_` — that would inline it into the browser bundle. |
| `NEXT_PUBLIC_APP_NAME` | no | `app/layout.tsx` | Cosmetic; defaults to `"Fireflies Clone"`. |

`.env.example` (committed) lists every variable with a placeholder; `.env.local` (gitignored) holds your actual key.

## Run

```bash
# dev server — http://localhost:3000
pnpm dev

# typecheck the whole project
pnpm typecheck

# lint
pnpm lint
```

## Tests (TDD-first)

Tests are written **before** their implementation, in the strict order schema → store → fetcher → hook → component → route (per the `fireflies-tdd` skill and constitution gate). Run them in watch mode while developing each slice:

```bash
# run the full suite once
pnpm test

# watch mode — the day-to-day TDD loop
pnpm test:watch

# focused: only schema tests (the layer below everything else)
pnpm test __tests__/schemas

# focused: hook tests for a specific resource
pnpm test __tests__/hooks/useMeetings
```

### Test environment quick reference

- `jest.config.ts` uses `testEnvironment: 'jsdom'` and a path alias `@/* → <rootDir>/*`.
- `jest.setup.ts` installs a minimal `MediaRecorder` polyfill and registers `@testing-library/jest-dom`.
- Hook and component tests render inside `createTestWrapper()` which provides a **fresh** `<SWRConfig>` per render with `provider: () => new Map()`. Without this, cached data leaks between tests — see R-005.
- Every test that reads or writes Zustand calls `resetStores()` in `beforeEach`. Without this, store state from a previous test bleeds into the next one.

### Common gotchas

- **A hook test passes alone but fails in the full suite** → almost always cache leakage. Confirm the test uses `createTestWrapper()` and that `resetStores()` is in `beforeEach`.
- **`MediaRecorder is not defined`** → the test imported `useRecording` but didn't import `jest.setup.ts` somehow. Run `pnpm test` (which uses the config), not a one-off `node` invocation.
- **`useSWR` returns `undefined` forever in a test** → check that the fetcher mock returns a Promise. SWR keys off promise resolution, not synchronous return values.

## The TDD loop for a new feature slice

Repeat for every user-story slice in `tasks.md`:

1. **Pick the next slice** (e.g. "create meeting form").
2. **Schema first**: write a failing `*.schema.test.ts` covering happy path + each validation rule, then write the minimum zod schema to pass.
3. **Store next** (only if the slice touches Zustand): write `*.store.test.ts` for each action/selector, then add it to the store.
4. **Fetcher next** (only if the slice touches the network): write `*.fetcher.test.ts` mocking `fetch` globally, then implement the plain async function.
5. **Hook next**: write `*.test.tsx` wrapping in `createTestWrapper()`, mocking `@/lib/fetchers/*`, then implement the hook on top of `useSWR` / `useSWRInfinite` / `useSWRMutation`.
6. **Component next**: write `*.test.tsx` mocking the hook at module level (`jest.mock('@/lib/hooks/use<X>')`), then build the component. Query by role/label, never by test-id.
7. **Route handler last** (if the slice touches `app/api/`): write a route-handler test (you can call the exported `GET` / `POST` directly), then implement.

If you find yourself wanting to implement before testing, stop — there's a reason `fireflies-tdd` calls this non-negotiable. Either the slice is too big (split it) or the test is unclear (figure out the observable behaviour first).

## Architecture map (where things live)

```
zod schemas  →  lib/schemas/             (one file per domain; export both schema and z.infer type)
network calls →  lib/fetchers/            (plain async; NO react/swr imports here)
SWR/Zustand   →  lib/hooks/, lib/store/   (the ONLY files that import swr or zustand)
UI            →  components/              (consumes hooks; never builds fetch())
API surface   →  app/api/**/route.ts      (the only place importing @anthropic-ai/sdk)
server store  →  lib/server/              (in-memory Map; seeded once per cold start)
```

The cleanest mental rule: if you're about to write a `fetch(...)` inside a component or hook test, stop — it belongs in `lib/fetchers/`. If you're about to import `swr` outside `lib/hooks/`, stop — components consume hooks, never SWR directly.

## How streaming summaries work end-to-end

(Worth knowing because it's the most subtle path in the app.)

1. User clicks "Generate summary" on a meeting detail page.
2. `useSummary(meetingId)` reads the current cache value. First time → no cached value, fires the fetcher.
3. The fetcher posts to `/api/claude` with `type: 'summary'`.
4. The route handler validates, calls `client.messages.stream({...})`, returns the resulting `ReadableStream` directly as the `Response` body.
5. The fetcher reads chunks via `res.body.getReader()`. As each chunk arrives, it decodes and yields it via an internal async iterator.
6. `SummaryView` is subscribed to this iterator and pushes each chunk into a local `useState<string>`. The user sees prose stream in token by token.
7. When the stream ends, the fetcher's promise resolves with the final concatenated string. SWR caches that string under `meetingKeys.summary(meetingId)`.
8. On any subsequent visit to the same meeting in the same session, `useSummary` returns the cached string instantly — `revalidateIfStale/OnFocus/OnReconnect: false` keeps it from re-running.

If you understand this flow, the rest of the app is straightforward.

## Troubleshooting

| Symptom | Probable cause |
|---|---|
| `401 unauthorized` on `/api/claude` | `ANTHROPIC_API_KEY` missing or invalid in `.env.local`. Restart `pnpm dev` after editing env vars. |
| Summary works once, but a re-open re-streams the same prose | A `useSWR` config option got overridden somewhere — the immutable bundle (`revalidateIfStale/OnFocus/OnReconnect: false`) is the fix. |
| Optimistic create disappears on error instead of rolling back | `rollbackOnError: true` is missing on the `mutate(...)` call. SWR does NOT rollback by default. |
| Dashboard refetches on every tab switch | A list-level hook is missing `dedupingInterval` and is letting the default-on `revalidateOnFocus` fire. |
| Tests pass alone, fail in the full suite | Cache or store leak. Check `createTestWrapper()` is being used and `resetStores()` is in `beforeEach`. |
| `MediaRecorder is not defined` | Test file isn't picking up `jest.setup.ts` — confirm `setupFilesAfterEnv` in `jest.config.ts`. |

## Where to go next

- **Read** `plan.md` for the full project layout and the constitution-gate rationale.
- **Read** `data-model.md` for entity field-by-field reference.
- **Read** `contracts/meetings.md` and `contracts/claude.md` for the wire-level API.
- **Run** `/speckit-tasks` next to generate `tasks.md` — the dependency-ordered work list.
