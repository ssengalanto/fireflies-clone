import { act, renderHook, waitFor } from '@testing-library/react'

import { transcribeAudio } from '@/lib/fetchers/transcribe.fetcher'
import { useTranscribeRecording } from '@/lib/hooks/useTranscribeRecording'

import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/fetchers/transcribe.fetcher', () => {
  const actual = jest.requireActual('@/lib/fetchers/transcribe.fetcher')
  return {
    ...actual,
    transcribeAudio: jest.fn(),
  }
})

const mockTranscribe = transcribeAudio as jest.MockedFunction<
  typeof transcribeAudio
>

function makeBlob(): Blob {
  return new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
}

beforeEach(() => {
  mockTranscribe.mockReset()
})

describe('useTranscribeRecording', () => {
  it('starts with isMutating=false, data=undefined, error=undefined', () => {
    const { result } = renderHook(() => useTranscribeRecording('mtg_1'), {
      wrapper: createTestWrapper(),
    })
    expect(result.current.isMutating).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeUndefined()
  })

  it('trigger calls the fetcher with the right shape and resolves with the response', async () => {
    mockTranscribe.mockResolvedValue({
      transcript: 'Alice: hi.',
      durationSeconds: 5,
    })

    const { result } = renderHook(() => useTranscribeRecording('mtg_1'), {
      wrapper: createTestWrapper(),
    })

    const blob = makeBlob()
    let value: unknown
    await act(async () => {
      value = await result.current.trigger(blob)
    })

    expect(mockTranscribe).toHaveBeenCalledWith({
      meetingId: 'mtg_1',
      audio: blob,
    })
    expect(value).toEqual({ transcript: 'Alice: hi.', durationSeconds: 5 })
    await waitFor(() => expect(result.current.isMutating).toBe(false))
    expect(result.current.data).toEqual({
      transcript: 'Alice: hi.',
      durationSeconds: 5,
    })
  })

  it('surfaces the typed TranscriptionError on fetcher rejection', async () => {
    mockTranscribe.mockRejectedValue({
      kind: 'NO_SPEECH',
      message: 'No speech detected',
    })

    const { result } = renderHook(() => useTranscribeRecording('mtg_1'), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await expect(result.current.trigger(makeBlob())).rejects.toEqual({
        kind: 'NO_SPEECH',
        message: 'No speech detected',
      })
    })

    await waitFor(() =>
      expect(result.current.error).toEqual({
        kind: 'NO_SPEECH',
        message: 'No speech detected',
      }),
    )
  })

  it('does not cache the result — a second trigger always re-invokes the fetcher', async () => {
    mockTranscribe
      .mockResolvedValueOnce({ transcript: 'first', durationSeconds: 1 })
      .mockResolvedValueOnce({ transcript: 'second', durationSeconds: 2 })

    const { result } = renderHook(() => useTranscribeRecording('mtg_1'), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await result.current.trigger(makeBlob())
    })
    await act(async () => {
      await result.current.trigger(makeBlob())
    })

    expect(mockTranscribe).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual({
      transcript: 'second',
      durationSeconds: 2,
    })
  })

  it('reset() clears data and error', async () => {
    mockTranscribe.mockResolvedValue({
      transcript: 'Alice: hi.',
      durationSeconds: 5,
    })

    const { result } = renderHook(() => useTranscribeRecording('mtg_1'), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await result.current.trigger(makeBlob())
    })
    expect(result.current.data).toBeDefined()

    await act(async () => {
      await result.current.reset()
    })
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeUndefined()
  })
})
