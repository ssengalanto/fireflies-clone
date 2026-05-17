import { act, renderHook, waitFor } from '@testing-library/react'

import {
  createMeeting,
  fetchMeetingsPage,
} from '@/lib/fetchers/meetings.fetcher'
import { useCreateMeeting } from '@/lib/hooks/useCreateMeeting'
import { useMeetings } from '@/lib/hooks/useMeetings'

import { resetStores } from '../utils/stores'
import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/fetchers/meetings.fetcher')
const mockList = fetchMeetingsPage as jest.MockedFunction<
  typeof fetchMeetingsPage
>
const mockCreate = createMeeting as jest.MockedFunction<typeof createMeeting>

const existing = {
  id: 'mtg_existing',
  title: 'Existing',
  participants: ['alice@example.com'],
  date: '2026-05-15T10:00:00.000Z',
  durationSeconds: 0,
  status: 'draft' as const,
  transcript: null,
  createdAt: '2026-05-15T10:00:00.000Z',
  updatedAt: '2026-05-15T10:00:00.000Z',
}

const newServerRecord = {
  ...existing,
  id: 'mtg_new',
  title: 'New meeting',
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
}

beforeEach(() => {
  resetStores()
  mockList.mockReset()
  mockCreate.mockReset()
})

function useBoth() {
  return { list: useMeetings(), create: useCreateMeeting() }
}

describe('useCreateMeeting', () => {
  it('places an optimistic temp- item at index 0, then replaces it with the server record', async () => {
    mockList.mockResolvedValue({ items: [existing], nextCursor: null })
    mockCreate.mockResolvedValue(newServerRecord)

    const { result } = renderHook(() => useBoth(), {
      wrapper: createTestWrapper(),
    })
    await waitFor(() => expect(result.current.list.data).toBeTruthy())

    let createPromise: Promise<unknown> | undefined
    act(() => {
      createPromise = result.current.create.create({
        title: 'New meeting',
        participants: ['alice@example.com'],
        date: '2026-05-17T10:00:00.000Z',
      })
    })

    // Optimistic item visible immediately — assert both fields in the same
    // waitFor cycle so the snapshot doesn't move out from under the test
    // when the mutation resolves.
    await waitFor(() => {
      const items = result.current.list.data?.[0].items
      expect(items?.[0].id).toMatch(/^temp-/)
      expect(items?.[0].title).toBe('New meeting')
      expect(items?.[1]?.id).toBe('mtg_existing')
    })

    await act(async () => {
      await createPromise
    })

    // After resolve, the temp item is replaced by the server's mtg_ record.
    await waitFor(() => {
      const items = result.current.list.data?.[0].items
      expect(items?.[0].id).toBe('mtg_new')
      expect(items?.[1]?.id).toBe('mtg_existing')
    })

    // populateCache + revalidate:false → no second list fetch.
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('rolls back the optimistic item on fetcher rejection', async () => {
    mockList.mockResolvedValue({ items: [existing], nextCursor: null })
    mockCreate.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useBoth(), {
      wrapper: createTestWrapper(),
    })
    await waitFor(() => expect(result.current.list.data).toBeTruthy())

    await act(async () => {
      await expect(
        result.current.create.create({
          title: 'New meeting',
          participants: ['alice@example.com'],
          date: '2026-05-17T10:00:00.000Z',
        }),
      ).rejects.toThrow('boom')
    })

    // After rollback the list is back to just the existing item.
    expect(result.current.list.data?.[0].items).toHaveLength(1)
    expect(result.current.list.data?.[0].items[0].id).toBe('mtg_existing')
  })
})
