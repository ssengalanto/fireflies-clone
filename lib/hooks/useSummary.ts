'use client'

import { useCallback, useState } from 'react'
import useSWR, { useSWRConfig, type SWRConfiguration } from 'swr'

import { meetingKeys } from '@/lib/api/cacheKeys'
import { fetchSummary } from '@/lib/fetchers/claude.fetcher'

const IMMUTABLE_CONFIG: SWRConfiguration = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  errorRetryCount: 1,
}

/**
 * Pure cache reader for a meeting's AI summary. Returns the cached string
 * if available; never fires a network request. The summary is populated by
 * `useSummaryStream.generate()` — generation is an explicit user action
 * (FR-007).
 */
export function useSummary(meetingId: string | undefined) {
  return useSWR<string>(
    meetingId ? meetingKeys.summary(meetingId) : null,
    null,
    IMMUTABLE_CONFIG,
  )
}

export interface UseSummaryStreamReturn {
  text: string
  isStreaming: boolean
  error: Error | null
  generate: () => Promise<void>
}

/**
 * Active streamer. `generate()` triggers a streaming fetch that delivers
 * tokens via `onChunk`, accumulating them into `text` for live rendering.
 * On success, the final concatenated string is written into SWR's cache
 * under `meetingKeys.summary(meetingId)` so any consumer of `useSummary`
 * sees it instantly on re-open.
 *
 * Errors are surfaced via `error` rather than re-thrown — the calling
 * component renders a retry affordance against this state.
 */
export function useSummaryStream(
  meetingId: string,
  transcript: string,
): UseSummaryStreamReturn {
  const { mutate } = useSWRConfig()
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generate = useCallback(async () => {
    setText('')
    setIsStreaming(true)
    setError(null)
    try {
      const final = await fetchSummary({ meetingId, transcript }, (chunk) => {
        setText((prev) => prev + chunk)
      })
      // Populate the cache so the next read via `useSummary` resolves
      // synchronously without re-streaming.
      await mutate(meetingKeys.summary(meetingId), final, { revalidate: false })
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsStreaming(false)
    }
  }, [meetingId, transcript, mutate])

  return { text, isStreaming, error, generate }
}
