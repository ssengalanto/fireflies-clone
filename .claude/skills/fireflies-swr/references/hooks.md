# Pattern: SWR Hooks

Three recurring shapes: paginated list, single detail, expensive/immutable response.

## Paginated list

Filters live in Zustand and flow into the key. Changing filters produces a new key, which SWR fetches fresh — no `useEffect` plumbing. `useSWRInfinite`'s `getKey` is called per page with the index and the previous page's data; return `null` to stop pagination.

```ts
import useSWRInfinite from 'swr/infinite'

export function use<Resource>s() {
  const filters = use<Resource>Store((s) => s.filters)

  return useSWRInfinite(
    (pageIndex, previousPage) => {
      if (previousPage && !previousPage.nextCursor) return null  // reached end
      return [...<resource>Keys.list(filters), pageIndex] as const
    },
    ([, , , , pageIndex]) =>
      fetch<Resource>s({ filters, page: pageIndex as number }),
    {
      dedupingInterval: <LIST_DEDUPE_MS>,
      revalidateFirstPage: false,                 // refetching the first page on every setSize wastes calls when filters didn't change
    },
  )
}
```

## Single detail

Return `null` from the key (here, when `id` is falsy) instead of conditionally calling the hook — SWR treats `null` as "do nothing" and the React render order stays stable.

```ts
import useSWR from 'swr'

export function use<Resource>(id: string | undefined) {
  return useSWR(
    id ? <resource>Keys.detail(id) : null,         // null disables the fetch — Rules-of-Hooks safe
    () => fetch<Resource>(id!),                    // safe because the fetcher only runs when key is non-null
    {
      dedupingInterval: <DETAIL_DEDUPE_MS>,
    },
  )
}
```

## Expensive / immutable response (AI, generated content)

The default revalidate-on-focus behaviour silently re-fires every time the user tabs back to the window. For a Claude generation, that's a real charge to the API account. Close every revalidation trigger and cap retries.

```ts
export function use<Generated>(parentId: string | undefined, input: <InputType> | undefined) {
  return useSWR(
    parentId && input && <readinessCheck> ? <resource>Keys.<sub>(parentId) : null,
    () => fetch<Generated>(parentId!, input!),
    {
      revalidateIfStale: false,                    // don't re-fire on remount when cached data exists
      revalidateOnFocus: false,                    // don't re-fire on tab switch
      revalidateOnReconnect: false,                // don't re-fire on network reconnect
      errorRetryCount: 1,                          // don't burn the API on persistent failures
    },
  )
}
```

## What to adapt

- `<Resource>` / `<resource>` — naming
- `<LIST_DEDUPE_MS>`, `<DETAIL_DEDUPE_MS>` — see the freshness decision table in `SKILL.md`
- `<readinessCheck>` — extra guard preventing fires on insufficient input (e.g. `input.length >= 10`)

## What stays fixed

- Keys come from the factory; never inline strings or arrays at the call site
- Conditional fetching is done by returning `null` from the key, *never* by wrapping `useSWR` in an `if`
- AI-response hooks always set all three `revalidate*: false` flags — any single one left at default re-fires the generation
- `errorRetryCount: 1` (not the default 5) for AI hooks — every retry is another billed request

## Reach for this when

- **List:** any indexable, filterable collection
- **Detail:** any single-record view
- **AI-response:** any query whose result is expensive to regenerate and never changes server-side
