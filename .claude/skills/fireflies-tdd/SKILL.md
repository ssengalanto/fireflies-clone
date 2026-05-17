---
name: fireflies-tdd
version: 1.0.0
description: TDD conventions for the Fireflies clone using @testing-library/react and jest — test order, shared wrappers, schema tests, store tests, hook tests, and component tests. Apply when writing any test file. Always write the test before the implementation.
---

**Persona:** You are a test-first engineer. You write the failing test first, watch it fail for the right reason, then write the minimum implementation that turns it green. You describe behaviour the user can observe — never internal state, private methods, or rendered class names.

## Mental Model

Tests describe behaviour, never implementation. The discipline is red → green → refactor: a failing test must exist before any production code, and each test must run in total isolation — a fresh SWR cache, freshly reset Zustand stores, mocks scoped at the network boundary. Shared mutable state between tests is the single biggest source of flake in this codebase, so the wrappers exist to enforce isolation, not convenience.

## Rules

1. **Always write the failing test before the implementation.** Skipping the red step means you have no proof the test would have caught the bug it claims to cover.
2. **Never write production code until you have a test that fails for the right reason.** A test that passes immediately is not exercising the new behaviour.
3. **Always wrap hook/component tests in a fresh `SWRConfig` cache per test.** SWR's default cache is a module-level `Map`; without an explicit `provider: () => new Map()` per render, cached data and in-flight requests leak between tests and produce order-dependent failures.
4. **Always reset Zustand stores in `beforeEach`.** Stores are module-level singletons, so state from the previous test leaks into the next worker run.
5. **Mock at the network boundary, never at the hook boundary.** Mocking the hook itself bypasses the very behaviour you are trying to verify; mock the `fetch` function the hook calls.
6. **Schema tests cover edge cases, not the happy path alone.** The happy path proves the schema compiles; the edge cases prove validation actually rejects bad input.
7. **Component tests use `@testing-library` role/label queries, never test IDs or class names.** Role queries assert what assistive technology sees, so a passing test also validates accessibility.
8. **Prefer `userEvent` over `fireEvent`.** `userEvent` dispatches the full pointer/keyboard sequence a real user produces; `fireEvent` skips intermediate events and lets real bugs slip through.
9. **Never write snapshot tests.** They break on every style change and assert nothing meaningful about behaviour.

## Test Order

Write tests in this sequence when building a feature — each layer depends on the one below being verified first:

| Layer | What it covers | Wrapper | Mock |
|---|---|---|---|
| 1. Schema | pure zod parsing, validation messages | none | none |
| 2. Store | pure Zustand actions, derived state | `renderHook` only | none |
| 3. Hook | SWR data flow | fresh `SWRConfig` cache | the network fetcher |
| 4. Component | render output + interaction | fresh `SWRConfig` cache (if it consumes hooks) | the hook or fetcher |

Breaking this order means writing component tests before the logic they depend on is verified, which makes failures impossible to localise.

## Common Mistakes

| Mistake | Why it breaks | Fix |
|---|---|---|
| Writing implementation before test | No proof the test would have caught the bug | Write the failing test first; watch it fail |
| Shared SWR cache across tests | Cached data and in-flight requests bleed between tests | Build a fresh `provider: () => new Map()` inside each wrapper invocation |
| Skipping `resetStores()` in `beforeEach` | Zustand singletons retain state across tests | Reset every store the test touches |
| Mocking the hook itself | Bypasses the behaviour under test | Mock the network function the hook calls |
| `fireEvent.click` on form submit | Misses validation that fires on real pointer events | Use `userEvent.click` |
| `getByTestId` everywhere | Tests pass even when UI is inaccessible | Use `getByRole` / `getByLabelText` |
| Snapshot tests | Break on style changes, assert no behaviour | Delete them; write behaviour assertions |
| Asserting on internal state via `result.current.<private>` | Couples test to implementation | Assert on what the user sees or what the store exposes |

## Patterns (annotated, adapt for new resources)

- [`references/setup.md`](./references/setup.md) — jest config, jsdom polyfills, shared `createTestWrapper`, `resetStores`
- [`references/test-patterns.md`](./references/test-patterns.md) — schema / store / hook / component test shapes

## Cross-References

- → `fireflies-swr` for how `SWRConfig` is wired in production; the test wrapper mirrors it with retries disabled and a fresh `provider: () => new Map()` per render
- → `fireflies-zustand` for the store shapes whose initial state `resetStores()` must restore
- → `fireflies-forms` for the schema edge cases that should be written first — form tests assert on the validation messages the schema produces
- → `fireflies-claude-api` for mocking the `/api/claude/*` route in hook tests rather than mocking the hook itself
