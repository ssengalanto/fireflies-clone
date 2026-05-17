'use client'

import useSWRMutation from 'swr/mutation'

import { meetingKeys } from '@/lib/api/cacheKeys'
import { updateTranscript } from '@/lib/fetchers/meetings.fetcher'

export function useUpdateTranscript(id: string) {
  return useSWRMutation(
    meetingKeys.detail(id),
    (_key, { arg }: { arg: string }) => updateTranscript(id, arg),
    { populateCache: true, revalidate: false },
  )
}
