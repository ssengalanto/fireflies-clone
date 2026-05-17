import { act, renderHook, waitFor } from '@testing-library/react'

import { fetchActionItems } from '@/lib/fetchers/claude.fetcher'
import { useActionItems } from '@/lib/hooks/useActionItems'

import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/fetchers/claude.fetcher', () => ({
  __esModule: true,
  fetchActionItems: jest.fn(),
  fetchSummary: jest.fn(),
  parseActionItems: jest.fn(),
}))
const mockFetch = fetchActionItems as jest.MockedFunction<typeof fetchActionItems>

const items = [
  { id: 'ai_1', text: 'Follow up with Bob', owner: null, dueDate: null },
  { id: 'ai_2', text: 'Send the deck', owner: null, dueDate: null },
]

beforeEach(() => {
  mockFetch.mockReset()
})

describe('useActionItems', () => {
  it('starts with undefined data and idle state', () => {
    const { result } = renderHook(
      () => useActionItems('mtg_1', 'x'.repeat(60)),
      { wrapper: createTestWrapper() },
    )
    expect(result.current.data).toBeUndefined()
    expect(result.current.isExtracting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not fire the fetcher when meetingId is missing', () => {
    renderHook(() => useActionItems(undefined, 'x'.repeat(60)), {
      wrapper: createTestWrapper(),
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('extract() calls the fetcher and surfaces the array via data', async () => {
    mockFetch.mockImplementation(async () => items)
    const { result } = renderHook(
      () => useActionItems('mtg_1', 'x'.repeat(60)),
      { wrapper: createTestWrapper() },
    )

    await act(async () => {
      await result.current.extract()
    })

    expect(mockFetch).toHaveBeenCalledWith({
      meetingId: 'mtg_1',
      transcript: 'x'.repeat(60),
    })
    await waitFor(() => {
      expect(result.current.data).toEqual(items)
    })
    expect(result.current.isExtracting).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('captures fetcher errors via error state, does not re-throw', async () => {
    mockFetch.mockRejectedValue(new Error('Failed to extract action items'))
    const { result } = renderHook(
      () => useActionItems('mtg_1', 'x'.repeat(60)),
      { wrapper: createTestWrapper() },
    )

    await act(async () => {
      await result.current.extract()
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe(
      'Failed to extract action items',
    )
    expect(result.current.isExtracting).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('no-ops when extract() is called without a transcript', async () => {
    const { result } = renderHook(() => useActionItems('mtg_1', ''), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await result.current.extract()
    })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.isExtracting).toBe(false)
  })

  it('does not refetch on window focus (immutable config)', async () => {
    mockFetch.mockImplementation(async () => items)
    const { result } = renderHook(
      () => useActionItems('mtg_1', 'x'.repeat(60)),
      { wrapper: createTestWrapper() },
    )
    await act(async () => {
      await result.current.extract()
    })
    const callsAfterExtract = mockFetch.mock.calls.length

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(mockFetch.mock.calls.length).toBe(callsAfterExtract)
  })
})
