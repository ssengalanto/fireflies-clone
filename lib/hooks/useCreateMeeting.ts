'use client'

import { useState } from 'react'
import useSWRInfinite from 'swr/infinite'

import { createMeeting } from '@/lib/fetchers/meetings.fetcher'
import type { MeetingPage } from '@/lib/fetchers/meetings.fetcher'
import type { Meeting, CreateMeetingInput } from '@/lib/schemas/meeting.schema'
import { useMeetingStore } from '@/lib/store/meetingStore'

import { makeMeetingsGetKey, meetingsFetcher } from './_meetingsCache'

function prependToFirstPage(
  pages: MeetingPage[] | undefined,
  meeting: Meeting,
): MeetingPage[] {
  if (!pages || pages.length === 0) {
    return [{ items: [meeting], nextCursor: null }]
  }
  const [first, ...rest] = pages
  return [{ ...first, items: [meeting, ...first.items] }, ...rest]
}

export function useCreateMeeting() {
  // Subscribe to the same infinite cache useMeetings reads from, so the
  // optimistic mutation here is visible there. SWR dedupes the underlying
  // fetch — this hook costs a subscription, not an extra network call.
  const filters = useMeetingStore((s) => s.filters)
  const { mutate } = useSWRInfinite(
    makeMeetingsGetKey(filters),
    meetingsFetcher,
    { dedupingInterval: 120_000, revalidateFirstPage: false },
  )

  const [isCreating, setIsCreating] = useState(false)

  const create = async (input: CreateMeetingInput): Promise<Meeting> => {
    const tempId = `temp-${crypto.randomUUID()}`
    const now = new Date().toISOString()
    const optimistic: Meeting = {
      id: tempId,
      title: input.title,
      participants: [...input.participants],
      date: input.date,
      durationSeconds: 0,
      status: 'draft',
      transcript: null,
      createdAt: now,
      updatedAt: now,
    }

    let created: Meeting | undefined

    setIsCreating(true)
    try {
      await mutate(
        // SWR's mutator receives the PRE-optimistic cache state. Prepend the
        // server record here so populateCache replaces the optimistic temp
        // item with the real one when the promise resolves.
        async (pages) => {
          created = await createMeeting(input)
          return prependToFirstPage(pages, created)
        },
        {
          optimisticData: (pages) =>
            prependToFirstPage(pages as MeetingPage[] | undefined, optimistic),
          rollbackOnError: true,
          populateCache: true,
          revalidate: false,
        },
      )
      if (!created) {
        throw new Error('Create succeeded but server record was not captured')
      }
      return created
    } finally {
      setIsCreating(false)
    }
  }

  return { create, isCreating }
}
