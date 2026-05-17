'use client'

import useSWR from 'swr'

import { meetingKeys } from '@/lib/api/cacheKeys'
import { fetchMeeting } from '@/lib/fetchers/meetings.fetcher'

export function useMeeting(id: string | undefined) {
  return useSWR(
    id ? meetingKeys.detail(id) : null,
    () => fetchMeeting(id as string),
    { dedupingInterval: 300_000 },
  )
}
