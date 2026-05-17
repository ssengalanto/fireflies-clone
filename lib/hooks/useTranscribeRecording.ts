'use client'

import useSWRMutation from 'swr/mutation'

import { meetingKeys } from '@/lib/api/cacheKeys'
import { transcribeAudio } from '@/lib/fetchers/transcribe.fetcher'
import type { TranscriptionError } from '@/lib/fetchers/transcribe.fetcher'
import type { TranscribeResponse } from '@/lib/schemas/transcribe.schema'

/**
 * Uploads a recorded audio Blob to `/api/transcribe` and surfaces the
 * produced text via `data`. The cache key participates in the meeting key
 * factory's namespace but the result is never read back — `useSWRMutation`
 * gives us `trigger`, `isMutating`, `data`, and `error` without caching.
 *
 * Error shape: `error` is the typed `TranscriptionError` thrown by the
 * fetcher (NETWORK | TOO_LARGE | NO_SPEECH | PROVIDER). Callers branch on
 * `error.kind` to pick which fallback affordances to render.
 */
export function useTranscribeRecording(meetingId: string): {
  trigger: (audio: Blob) => Promise<TranscribeResponse>
  reset: () => void
  data: TranscribeResponse | undefined
  error: TranscriptionError | undefined
  isMutating: boolean
} {
  const mutation = useSWRMutation<
    TranscribeResponse,
    TranscriptionError,
    ReturnType<typeof meetingKeys.transcribe>,
    Blob
  >(meetingKeys.transcribe(meetingId), (_key, { arg }) =>
    transcribeAudio({ meetingId, audio: arg }),
  )

  return {
    trigger: mutation.trigger,
    reset: mutation.reset,
    data: mutation.data,
    error: mutation.error,
    isMutating: mutation.isMutating,
  }
}
