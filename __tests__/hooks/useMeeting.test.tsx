import { renderHook, waitFor } from '@testing-library/react'

import { fetchMeeting } from '@/lib/fetchers/meetings.fetcher'
import { useMeeting } from '@/lib/hooks/useMeeting'

import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/fetchers/meetings.fetcher')
const mockFetch = fetchMeeting as jest.MockedFunction<typeof fetchMeeting>

const meeting = {
  id: 'mtg_1',
  title: 'Standup',
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
  durationSeconds: 0,
  status: 'draft' as const,
  transcript: null,
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('useMeeting', () => {
  it('does not fetch when id is undefined', async () => {
    const { result } = renderHook(() => useMeeting(undefined), {
      wrapper: createTestWrapper(),
    })
    // Give SWR a microtask to consider firing
    await new Promise((r) => setTimeout(r, 0))
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it('resolves with the fetched meeting', async () => {
    mockFetch.mockResolvedValue(meeting)
    const { result } = renderHook(() => useMeeting('mtg_1'), {
      wrapper: createTestWrapper(),
    })
    await waitFor(() => expect(result.current.data).toEqual(meeting))
    expect(mockFetch).toHaveBeenCalledWith('mtg_1')
  })

  it('surfaces 404 as an error', async () => {
    mockFetch.mockRejectedValue(new Error('Meeting not found'))
    const { result } = renderHook(() => useMeeting('mtg_x'), {
      wrapper: createTestWrapper(),
    })
    await waitFor(() => expect(result.current.error).toBeDefined())
    expect((result.current.error as Error).message).toBe('Meeting not found')
  })
})
