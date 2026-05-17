import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'

/**
 * Returns a React tree wrapper that mounts a fresh, isolated SWR cache for
 * a single test. Each call to `createTestWrapper()` closes over a new `Map`,
 * so tests that share a module-level cache cannot leak data between runs.
 *
 * Defaults inside the wrapper are tuned for predictability:
 * - `dedupingInterval: 0`     — second call within a test should still hit the fetcher.
 * - `shouldRetryOnError: false` — retries hide the failure the test means to assert.
 * - `revalidateOnFocus/Reconnect: false` — jsdom fires focus events; we don't want
 *   them to trigger background refetches mid-assertion.
 */
export function createTestWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          shouldRetryOnError: false,
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
        }}
      >
        {children}
      </SWRConfig>
    )
  }
}
