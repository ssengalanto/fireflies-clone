import { act, renderHook } from '@testing-library/react'

import { useRecording } from '@/lib/hooks/useRecording'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useRecording', () => {
  it('starts in the idle state with no audio blob', () => {
    const { result } = renderHook(() => useRecording())
    expect(result.current.status).toBe('idle')
    expect(result.current.elapsed).toBe(0)
    expect(result.current.audioBlob).toBeNull()
  })

  it('start() transitions to recording and calls getUserMedia + MediaRecorder.start', async () => {
    const { result } = renderHook(() => useRecording())
    await act(async () => {
      await result.current.start()
    })
    expect(result.current.status).toBe('recording')
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    })
  })

  it('elapsed increments while recording', async () => {
    const { result } = renderHook(() => useRecording())
    await act(async () => {
      await result.current.start()
    })
    act(() => {
      jest.advanceTimersByTime(3_000)
    })
    expect(result.current.elapsed).toBe(3)
  })

  it('stop() transitions to stopped and freezes the ticker', async () => {
    const { result } = renderHook(() => useRecording())
    await act(async () => {
      await result.current.start()
    })
    act(() => {
      jest.advanceTimersByTime(2_000)
    })
    act(() => result.current.stop())
    expect(result.current.status).toBe('stopped')
    const frozen = result.current.elapsed
    act(() => {
      jest.advanceTimersByTime(5_000)
    })
    expect(result.current.elapsed).toBe(frozen)
  })
})
