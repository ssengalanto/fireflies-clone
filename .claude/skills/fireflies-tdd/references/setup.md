# Pattern: Jest Setup & Shared Wrappers

The same jest config, jsdom polyfills, and two utilities (`createTestWrapper`, `resetStores`) underpin every test in the suite. They exist to guarantee isolation — a fresh `SWRConfig` cache per test and a deterministic starting state for every Zustand store.

## jest.config.ts

```ts
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/<SRC_DIR>/$1' },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
}

export default config
```

## jest.setup.ts

```ts
import '@testing-library/jest-dom'

// Polyfill any browser API jsdom doesn't ship.
// Each entry should mirror what the component actually calls.
global.<MissingBrowserApi> = jest.fn().mockImplementation(() => ({
  <method>: jest.fn(),
  <state>: <defaultValue>,
})) as unknown as typeof <MissingBrowserApi>
```

## Shared Test Wrapper

```tsx
// <TESTS_DIR>/utils/wrapper.tsx
import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'

export function createTestWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SWRConfig
        value={{
          provider: () => new Map(),       // fresh cache per render — the linchpin of test isolation
          dedupingInterval: 0,             // each call goes through; tests assert on every fetch
          shouldRetryOnError: false,       // retries mask the failure we want to assert on
          revalidateOnFocus: false,        // jsdom focus events would otherwise refetch mid-assertion
          revalidateOnReconnect: false,
        }}
      >
        {children}
      </SWRConfig>
    )
  }
}
```

## Store Reset Utility

```ts
// <TESTS_DIR>/utils/stores.ts
import { use<StoreA> } from '@/<STORE_PATH>/<storeA>'
import { use<StoreB> } from '@/<STORE_PATH>/<storeB>'

export function resetStores() {
  use<StoreA>.setState(<INITIAL_STATE_A>)
  use<StoreB>.setState(<INITIAL_STATE_B>)
}
```

## What to adapt

- `<SRC_DIR>` — source directory alias maps to (`src`, `app`, etc.)
- `<TESTS_DIR>` — root of your test utilities (`__tests__`, `tests`)
- `<MissingBrowserApi>` / `<method>` — only polyfills you actually need; do not preemptively shim everything
- `<StoreA>`, `<StoreB>` — one entry per Zustand store the suite touches
- `<INITIAL_STATE_A>` — the literal initial-state object from the store's `create()` call

## What stays fixed

- `testEnvironment: 'jsdom'` — required for any test that renders a component
- `createTestWrapper` returns a **new function** each call, and `provider: () => new Map()` is itself a factory — both layers must stay inside the function so each render gets a fresh cache. Lifting the `Map` outside the factory silently re-shares it.
- `shouldRetryOnError: false`, `dedupingInterval: 0`, and `revalidateOnFocus/Reconnect: false` on the test config — retries mask the failure you want to assert; deduping makes the second call in a test silently skip; the focus/reconnect events jsdom fires would otherwise refetch mid-assertion
- `resetStores()` is called from `beforeEach`, not `beforeAll` — `beforeAll` only resets once

## Reach for this when

- Setting up the test suite for the first time
- Adding a new Zustand store (extend `resetStores`)
- A test fails only when run with others (almost always missing isolation — wrapper or reset)
