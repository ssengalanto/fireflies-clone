# Pattern: Cache Key Factory

Group every resource's keys under one typed factory. Nest child keys inside parent keys so a `mutate((key) => ...)` predicate can match the whole subtree by string prefix.

```ts
// lib/api/cacheKeys.ts
export const <RESOURCE>Keys = {
  all: ['<resource>'] as const,                                       // root — predicate match invalidates everything for the resource
  lists: () => [...<RESOURCE>Keys.all, 'list'] as const,              // root for any list view
  list: (filters: <FiltersType>) =>
    [...<RESOURCE>Keys.lists(), filters] as const,                    // filters baked into the key — changing them produces a new key, which SWR fetches fresh
  detail: (id: string) =>
    [...<RESOURCE>Keys.all, 'detail', id] as const,                   // root for any single-record view
  <subResource>: (id: string) =>
    [...<RESOURCE>Keys.detail(id), '<sub-resource>'] as const,        // nest sub-resources under detail() — predicate-based mutate on the record clears them too
}
```

## What to adapt

- `<RESOURCE>` — singular camelCase noun: `meeting`, `user`, `org`
- `<resource>` — cache root literal: `'meetings'`, `'users'`
- `<FiltersType>` — the filters object shape that affects the query
- `<subResource>` — per-record children: `'summary'`, `'action-items'`, `'comments'`

## What stays fixed

- `as const` on every tuple — TypeScript inference for the key argument of `useSWR<T, E, typeof key>` depends on it
- `all` is an array, not a function — it's the root, not parameterized
- Sub-resources nest under `detail(id)`, never under `all` — per-record predicate invalidation requires the nesting
- Keys returned to `useSWR` may be arrays — SWR serializes them stably, so `[..., { page: 1 }]` and `[..., { page: 1 }]` hit the same cache entry across renders

## Predicate-based invalidation (the "why nesting matters")

Global `mutate` accepts a function instead of a key string. It walks the cache and runs it against each entry. Tuple keys serialize to JSON, so a prefix match against `'meeting'` will hit *every* meeting cache entry — list, detail, summary, action-items — provided they all start with the same `all` root.

```ts
const { mutate } = useSWRConfig()

// Nuke everything for one meeting (detail + its summary + its action items)
await mutate(
  (key) => Array.isArray(key) && key[0] === 'meeting' && key[2] === id,
  undefined,
  { revalidate: true },
)
```

If you had stored the summary under `['summary', id]` (flat, parallel to `meeting`) instead of `['meeting', 'detail', id, 'summary']` (nested), this predicate couldn't reach it and you'd be back to invalidating two roots manually.

## Reach for this when

You add a new server-backed resource. The factory is the *first* file you create for that resource — hooks reference it, not the other way around.
