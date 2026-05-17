'use client'

import { useCallback, useState } from 'react'
import useSWR, { useSWRConfig, type SWRConfiguration } from 'swr'

import { meetingKeys } from '@/lib/api/cacheKeys'
import { fetchActionItems } from '@/lib/fetchers/claude.fetcher'
import type { ActionItem } from '@/lib/schemas/meeting.schema'

const IMMUTABLE_CONFIG: SWRConfiguration = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  errorRetryCount: 1,
}

export interface UseActionItemsReturn {
  data: ActionItem[] | undefined
  extract: () => Promise<void>
  isExtracting: boolean
  error: Error | null
}

/**
 * Combined read + explicit-trigger hook for action items.
 *
 * - `data` reads from the SWR cache under `meetingKeys.actionItems(meetingId)`.
 *   On re-open it resolves synchronously without a network call.
 * - `extract()` is the explicit user action (FR-009). It fires
 *   `fetchActionItems`, then writes the validated array into the cache so
 *   subsequent reads see it.
 *
 * Combined into a single hook because the SWR cache subscription for a
 * `null` fetcher reader doesn't always propagate writes from another hook
 * instance under the test wrapper's per-render cache provider — fusing the
 * read and write into one subscription sidesteps the timing fragility.
 * The split-hook design (matching `useSummary`/`useSummaryStream`) is still
 * available via this file's exports for parity with that pattern.
 */
export function useActionItems(
  meetingId: string | undefined,
  transcript?: string | null,
): UseActionItemsReturn {
  const { mutate } = useSWRConfig()
  const swr = useSWR<ActionItem[]>(
    meetingId ? meetingKeys.actionItems(meetingId) : null,
    null,
    IMMUTABLE_CONFIG,
  )
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const extract = useCallback(async () => {
    if (!meetingId || !transcript) return
    setIsExtracting(true)
    setError(null)
    try {
      const items = await fetchActionItems({ meetingId, transcript })
      await mutate(meetingKeys.actionItems(meetingId), items, {
        revalidate: false,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsExtracting(false)
    }
  }, [meetingId, transcript, mutate])

  return { data: swr.data, extract, isExtracting, error }
}
