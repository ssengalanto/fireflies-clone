'use client'

import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'

/**
 * Default fetcher used when a hook doesn't pass its own. The vast majority
 * of hooks in `lib/hooks/` supply a typed fetcher from `lib/fetchers/`, so
 * this only fires for simple ad-hoc `useSWR('/some/path')` calls.
 */
const defaultFetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error(`Request failed with ${res.status}`)
    }
    return res.json()
  })

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: defaultFetcher,
        dedupingInterval: 60_000,
        errorRetryCount: 1,
        revalidateOnFocus: true,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  )
}
