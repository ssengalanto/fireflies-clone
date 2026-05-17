'use client'

import useSWRInfinite from 'swr/infinite'

import { useMeetingStore } from '@/lib/store/meetingStore'

import { makeMeetingsGetKey, meetingsFetcher } from './_meetingsCache'

export function useMeetings() {
  const filters = useMeetingStore((s) => s.filters)
  return useSWRInfinite(makeMeetingsGetKey(filters), meetingsFetcher, {
    dedupingInterval: 120_000,
    revalidateFirstPage: false,
  })
}
