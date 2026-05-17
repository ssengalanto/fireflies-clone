# Pattern: SWRConfig Provider

Mounted once at the root. Unlike TanStack Query, SWR's default cache is a global module-level `Map` — fine in production, dangerous in tests where it leaks between renders. Pass an explicit `provider` factory so each mount gets its own `Map`, and override the few defaults that aren't right for this codebase.

```tsx
'use client'
import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'

const fetcher = (input: string | [string, ...unknown[]]) =>
  fetch(typeof input === 'string' ? input : input[0]).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`)
    return r.json()
  })

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        fetcher,                                       // resource hooks may still pass their own to ignore this default
        dedupingInterval: <GLOBAL_DEDUPE_MS>,          // sane floor; per-hook configs override
        errorRetryCount: <DEFAULT_RETRY_COUNT>,        // 1 is usually right; 0 if every endpoint is Claude
        revalidateOnFocus: true,                       // safe default; AI hooks opt out individually
      }}
    >
      {children}
    </SWRConfig>
  )
}
```

## What to adapt

- `<GLOBAL_DEDUPE_MS>` — sane floor for hooks that don't override (`1000 * 60` is a good default)
- `<DEFAULT_RETRY_COUNT>` — `1` is usually right; `0` if all your mutations hit an expensive AI endpoint
- The generic `fetcher` — if every hook supplies its own typed fetcher, the global one is optional, but keeping it documents the call shape

## What stays fixed

- `provider: () => new Map()` — a *factory*, not a literal `new Map()`. The factory is called once per `SWRConfig` mount, so re-renders share one cache while remounts (and tests) get fresh ones.
- `'use client'` directive — `SWRConfig` is a client component
- Default `revalidateOnFocus: true` at the root — AI-response hooks turn this off per-hook so the global default stays useful for the common case

## Why no module-level singleton cache

SWR's *default* (omitting `provider`) is a process-wide singleton `Map`. That's fine in a long-lived browser tab — but in Node SSR (Next.js route handlers, RSC tests) the module persists across requests, and in Jest test suites it persists across test files run in the same worker. A test that creates a meeting in test A pre-seeds the cache for test B and you get an order-dependent failure with no obvious cause. The factory function is the SWR-recommended fix and costs effectively nothing.

## Reach for this when

Setting up a new app, or wrapping a sub-tree that needs cache isolation (rare in production — common in tests via `createTestWrapper`, which mirrors this provider shape).
