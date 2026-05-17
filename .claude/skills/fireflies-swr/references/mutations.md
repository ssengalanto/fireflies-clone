# Pattern: Optimistic Mutation

Two shapes — pick by intent.

- **`useSWRMutation`** — user-triggered write bound to a single key (form submit, button action). Returns `trigger`, `isMutating`, `error`. Best for forms because it exposes the in-flight flag the UI needs.
- **Global `mutate` from `useSWRConfig()`** — one action affects multiple cache keys, or you need to invalidate by predicate.

Both share the same four-option contract for optimistic updates: `optimisticData`, `rollbackOnError`, `populateCache`, `revalidate`. SWR handles snapshot/restore and request cancellation internally — there is no manual `cancelQueries` step like in TanStack Query, but `rollbackOnError: true` is **opt-in**: forget it and a failed mutation leaves the optimistic UI permanently wrong.

## Shape 1: `useSWRMutation` (preferred for forms / buttons)

```ts
import useSWRMutation from 'swr/mutation'

export function use<Action><Resource>() {
  return useSWRMutation(
    <affectedKey>,                                  // the key this mutation revalidates / updates
    async (_key, { arg }: { arg: <ArgType> }) =>
      <serverCall>(arg),
    {
      optimisticData: (current: <T> | undefined) =>
        <optimisticUpdate>(current, /* arg is not in this scope — see below */),
      rollbackOnError: true,                        // MUST be set; SWR does not rollback by default
      populateCache: (returned, current) =>
        <mergeServerResponse>(current, returned),   // optional — only if the server response is the new canonical value
      revalidate: false,                            // skip refetch when populateCache already has the truth
    },
  )
}
```

Because `optimisticData` in the hook options doesn't have access to `arg`, pass it at the `trigger` call site instead when the optimistic shape depends on the argument:

```ts
const { trigger, isMutating, error } = use<Action><Resource>()

await trigger(<arg>, {
  optimisticData: (current) => <optimisticUpdate>(current, <arg>),
  rollbackOnError: true,
})
```

## Shape 2: Global `mutate` (cross-cache fanout)

Use when one mutation must touch multiple keys — e.g. creating a meeting both prepends it to the list and seeds the detail cache.

```ts
import { useSWRConfig } from 'swr'

export function useCreate<Resource>() {
  const { mutate } = useSWRConfig()

  return async (input: <InputType>) => {
    await mutate(
      <resource>Keys.lists(),                       // primary key
      async (current: <ListT> | undefined) => {
        const created = await <serverCall>(input)
        // Seed the detail cache too, no second network call needed:
        mutate(<resource>Keys.detail(created.id), created, { revalidate: false })
        return <prependToList>(current, created)
      },
      {
        optimisticData: (current) =>
          <prependToList>(current, { ...input, id: `temp-${crypto.randomUUID()}` }),
        rollbackOnError: true,
        populateCache: true,                        // promise resolution replaces the optimistic value
        revalidate: false,                          // we already have the canonical record
      },
    )
  }
}
```

## What to adapt

- `<Action>` / `<Resource>` — `Create`, `Update`, `Delete` × resource
- `<serverCall>` — the network function (returns a promise)
- `<affectedKey>` — `<resource>Keys.lists()` for create/delete on a list; `<resource>Keys.detail(id)` for an update on a record
- `<optimisticUpdate>` — pure transform from current state to next (prepend, replace, filter)
- `<mergeServerResponse>` — if the server returns a fully-formed record, return it; if partial, merge into `current`
- Temp IDs — prefix synthesized IDs with `'temp-'` so the UI can distinguish in-flight items

## What stays fixed

- `rollbackOnError: true` is mandatory on any optimistic mutation — SWR rolls back only when asked
- `revalidate: false` goes hand-in-hand with `populateCache` returning the *full* server record; if the response is partial, leave `revalidate: true` so SWR fetches the canonical state
- `useSWRMutation` is preferred when one button maps to one key; reach for global `mutate` only when fanout is real
- Temp-prefixed IDs in optimistic data — without them, the UI can't render a pending state distinct from confirmed items

## Reach for this when

Any mutation that changes data the user can see in the cache. If the mutation only triggers a background side-effect (e.g. analytics ping), skip optimistic and just `await fetch(...)` directly — no SWR involvement needed.
