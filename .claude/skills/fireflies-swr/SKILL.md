---
name: fireflies-swr
version: 1.0.0
description: SWR conventions for the Fireflies clone — cache key factories, useSWR / useSWRInfinite / useSWRMutation hooks, optimistic updates via mutate, and SWRConfig wiring. Apply when writing any data-fetching hook, mutation, or SWRConfig setup. Not for client UI state (→ see fireflies-zustand).
---

**Persona:** You are a data-fetching architect. You treat server state and client state as fundamentally different things — never conflating them. You always think about stale-while-revalidate, cache invalidation, and rollback before writing a single line of mutation code.

## Mental Model

SWR owns all *remote* data. Zustand owns all *local* UI state. Nothing server-side ever touches Zustand directly — the boundary is strict because mixing them creates subtle bugs where stale cached data and local state fall out of sync with no clear owner.

SWR's stale-while-revalidate model: every render reads from the in-memory cache instantly, and SWR transparently revalidates in the background based on focus, reconnect, and an explicit dedupe window. That means most "freshness" knobs aren't a single `staleTime` like TanStack Query — they're a small bundle of options (`dedupingInterval`, `revalidateIfStale`, `revalidateOnFocus`, `revalidateOnReconnect`) you tune together for each shape of data.

## Rules

1. **Always use a cache key factory; never inline string keys.** Scattered string keys make targeted revalidation unpredictable and cause silent cache misses after refactors.
2. **Never store SWR data in Zustand.** Two sources of truth diverge silently. Read directly from `useSWR`.
3. **Always tune freshness explicitly when the defaults are wrong.** Defaults revalidate on every window focus — fine for a meeting list, ruinous for a Claude summary that costs money to regenerate.
4. **Always express "don't fetch yet" by returning `null` from the key, never by skipping the hook.** Wrapping `useSWR` in an `if` is a Rules-of-Hooks violation; SWR treats a `null` key as "do nothing" and is the supported escape hatch.
5. **Prefer `useSWRMutation` for user-triggered writes; reach for global `mutate` only when one action must touch multiple cache keys.** `useSWRMutation` gives you `trigger`, `isMutating`, and an error state bound to a single key — the right primitive for form submits and button actions.
6. **Always pass `rollbackOnError: true` on any optimistic mutation.** SWR rolls back automatically *only* when you opt in; omit it and a failed request leaves the optimistic UI permanently wrong.
7. **Set `revalidate: false` when `populateCache` already contains the canonical server response; otherwise leave it `true`.** Re-fetching after the server already returned the new record is wasted bandwidth; skipping revalidation when the response is partial leaves the cache wrong.
8. **Mount `SWRConfig` with a fresh `provider: () => new Map()` in every test wrapper.** The default global Map is shared across renders and test runs, leaking cached responses between unrelated trees.

## Freshness Decision Table

| Data | Config | Why |
|---|---|---|
| Meeting list | `dedupingInterval: 2 * 60 * 1000` | User expects near-real-time list; default focus revalidation stays on |
| Meeting detail | `dedupingInterval: 5 * 60 * 1000` | Rarely changes mid-session |
| Claude summary | `revalidateIfStale: false`, `revalidateOnFocus: false`, `revalidateOnReconnect: false` | AI responses are immutable once generated; refetching costs real money |
| Action items | Same as summary | Same — expensive to regenerate |

The Claude bundle is three options because there is no single "never refetch" switch in SWR. Each option closes one revalidation trigger; together they freeze the cache entry until something explicitly mutates it.

## Common Mistakes

| Mistake | Why it breaks | Fix |
|---|---|---|
| Inline string keys | Cache misses after rename, can't pattern-match in global `mutate` | Use the key factory |
| Storing SWR data in Zustand | Two sources of truth diverge | Read directly from `useSWR` |
| Default `revalidateOnFocus` on Claude responses | Re-triggers expensive AI generation on tab switch | Disable focus/reconnect/stale revalidation for AI hooks |
| `if (id) useSWR(...)` to skip fetches | Hooks called conditionally — React errors | Return `null` from the key |
| Optimistic mutation without `rollbackOnError` | Failed request leaves UI permanently optimistic | Always pass `rollbackOnError: true` |
| `revalidate: true` after `populateCache` with full server response | Wasted refetch on data you already have | Set `revalidate: false` when the response is authoritative |
| Default global cache in tests | Cached data leaks between tests, order-dependent failures | `<SWRConfig value={{ provider: () => new Map() }}>` per test |
| Mutating the SWR cache object directly | SWR doesn't see the change; UI doesn't update | Go through `mutate` — never reassign the cached object in place |

## Patterns (annotated, adapt for new resources)

- [`references/cache-keys.md`](./references/cache-keys.md) — key factory shape
- [`references/hooks.md`](./references/hooks.md) — list / detail / AI-response hooks
- [`references/mutations.md`](./references/mutations.md) — `useSWRMutation` + global `mutate` optimistic updates
- [`references/provider.md`](./references/provider.md) — `SWRConfig` + DevTools setup

## Cross-References

- → `fireflies-zustand` for client/UI state that must not enter SWR
- → `fireflies-tdd` for how to wrap hooks in a fresh `SWRConfig` cache per test
- → `fireflies-claude-api` for `useSummary` / `useActionItems` — the AI-response hook pattern is documented here, the route + fetcher conventions live there
