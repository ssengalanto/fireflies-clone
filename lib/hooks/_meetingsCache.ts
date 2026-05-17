import type { MeetingFilters } from '@/lib/api/cacheKeys'
import { meetingKeys } from '@/lib/api/cacheKeys'
import {
  fetchMeetingsPage,
  type MeetingPage,
} from '@/lib/fetchers/meetings.fetcher'

/**
 * Shared SWRInfinite plumbing for the meetings list. `useMeetings` (read)
 * and `useCreateMeeting` (write) both subscribe via this helper so a single
 * optimistic mutation lands on the same cache entry the list renders from.
 */

export type MeetingsInfiniteKey = readonly [
  'meeting',
  'list',
  MeetingFilters,
  string | null,
]

export function makeMeetingsGetKey(filters: MeetingFilters) {
  return function getKey(
    pageIndex: number,
    prev: MeetingPage | null,
  ): MeetingsInfiniteKey | null {
    if (pageIndex === 0) {
      return [...meetingKeys.list(filters), null] as MeetingsInfiniteKey
    }
    if (!prev || !prev.nextCursor) return null
    return [...meetingKeys.list(filters), prev.nextCursor] as MeetingsInfiniteKey
  }
}

export async function meetingsFetcher(
  key: MeetingsInfiniteKey,
): Promise<MeetingPage> {
  const filters = key[2]
  const cursor = key[3]
  return fetchMeetingsPage({
    ...filters,
    cursor: cursor ?? undefined,
    limit: 20,
  })
}
