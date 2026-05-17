import { act, renderHook, waitFor } from '@testing-library/react'

import { updateTranscript } from '@/lib/fetchers/meetings.fetcher'
import { useUpdateTranscript } from '@/lib/hooks/useUpdateTranscript'

import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/fetchers/meetings.fetcher')
const mockUpdate = updateTranscript as jest.MockedFunction<
  typeof updateTranscript
>

const updated = {
  id: 'mtg_1',
  title: 'Standup',
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
  durationSeconds: 1820,
  status: 'recorded' as const,
  transcript: 'Alice: hi.',
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T11:00:00.000Z',
}

beforeEach(() => {
  mockUpdate.mockReset()
})

describe('useUpdateTranscript', () => {
  it('starts with isMutating=false', () => {
    const { result } = renderHook(() => useUpdateTranscript('mtg_1'), {
      wrapper: createTestWrapper(),
    })
    expect(result.current.isMutating).toBe(false)
  })

  it('trigger calls the fetcher and resolves with the updated meeting', async () => {
    mockUpdate.mockResolvedValue(updated)
    const { result } = renderHook(() => useUpdateTranscript('mtg_1'), {
      wrapper: createTestWrapper(),
    })

    let value: unknown
    await act(async () => {
      value = await result.current.trigger('Alice: hi.')
    })
    expect(mockUpdate).toHaveBeenCalledWith('mtg_1', 'Alice: hi.')
    expect(value).toEqual(updated)
    await waitFor(() => expect(result.current.isMutating).toBe(false))
  })

  it('trigger throws on fetcher rejection so the form submit can branch on it', async () => {
    mockUpdate.mockRejectedValue(new Error('Transcript cannot be empty'))
    const { result } = renderHook(() => useUpdateTranscript('mtg_1'), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await expect(result.current.trigger('')).rejects.toThrow(
        'Transcript cannot be empty',
      )
    })
  })
})
