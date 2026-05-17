import { act, renderHook, waitFor } from '@testing-library/react'

import { fetchMeetingsPage } from '@/lib/fetchers/meetings.fetcher'
import { useMeetings } from '@/lib/hooks/useMeetings'
import { useMeetingStore } from '@/lib/store/meetingStore'

import { resetStores } from '../utils/stores'
import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/fetchers/meetings.fetcher')
const mockFetcher = fetchMeetingsPage as jest.MockedFunction<
  typeof fetchMeetingsPage
>

const meeting = (id: string) => ({
  id,
  title: `Meeting ${id}`,
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
  durationSeconds: 0,
  status: 'draft' as const,
  transcript: null,
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
})

beforeEach(() => {
  resetStores()
  mockFetcher.mockReset()
})

describe('useMeetings', () => {
  it('starts in loading state', () => {
    mockFetcher.mockResolvedValue({
      items: [meeting('1')],
      nextCursor: null,
    })
    const { result } = renderHook(() => useMeetings(), {
      wrapper: createTestWrapper(),
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('resolves with page data on success', async () => {
    mockFetcher.mockResolvedValue({
      items: [meeting('1'), meeting('2')],
      nextCursor: null,
    })
    const { result } = renderHook(() => useMeetings(), {
      wrapper: createTestWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(result.current.data?.[0].items).toHaveLength(2)
    expect(result.current.error).toBeUndefined()
  })

  it('surfaces an error when the fetcher rejects', async () => {
    mockFetcher.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useMeetings(), {
      wrapper: createTestWrapper(),
    })
    await waitFor(() => expect(result.current.error).toBeDefined())
    expect((result.current.error as Error).message).toBe('boom')
  })

  it('refetches when filters change (new SWR key)', async () => {
    mockFetcher.mockResolvedValue({ items: [], nextCursor: null })
    const { result } = renderHook(() => useMeetings(), {
      wrapper: createTestWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    const callsAfterFirst = mockFetcher.mock.calls.length

    act(() => useMeetingStore.getState().setFilter({ search: 'standup' }))

    await waitFor(() => {
      expect(mockFetcher.mock.calls.length).toBeGreaterThan(callsAfterFirst)
    })
    const lastCall = mockFetcher.mock.calls.at(-1)![0]
    expect(lastCall.search).toBe('standup')
  })

  it('does not refetch page 0 on setSize (revalidateFirstPage: false)', async () => {
    mockFetcher.mockImplementation(async ({ cursor }) => {
      if (!cursor) {
        return { items: [meeting('1')], nextCursor: 'cur_1' }
      }
      return { items: [meeting('2')], nextCursor: null }
    })

    const { result } = renderHook(() => useMeetings(), {
      wrapper: createTestWrapper(),
    })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(mockFetcher).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.setSize(2)
    })
    await waitFor(() => expect(result.current.data).toHaveLength(2))

    // exactly two calls: page 0 once, page 1 once. No re-fetch of page 0.
    expect(mockFetcher).toHaveBeenCalledTimes(2)
  })
})
