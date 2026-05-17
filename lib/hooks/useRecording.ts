'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped'

export interface UseRecordingReturn {
  status: RecordingStatus
  elapsed: number
  start: () => Promise<void>
  stop: () => void
  pause: () => void
  resume: () => void
  audioBlob: Blob | null
}

export function useRecording(): UseRecordingReturn {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTicker = useCallback(() => {
    if (tickerRef.current !== null) {
      clearInterval(tickerRef.current)
      tickerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopTicker()
      recorderRef.current = null
    }
  }, [stopTicker])

  const start = useCallback(async () => {
    if (status === 'recording') return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunksRef.current = []
    const rec = new MediaRecorder(stream)
    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
    }
    rec.start()
    recorderRef.current = rec
    setElapsed(0)
    setStatus('recording')
    tickerRef.current = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1000)
  }, [status])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    stopTicker()
    setStatus('stopped')
  }, [stopTicker])

  const pause = useCallback(() => {
    recorderRef.current?.pause()
    stopTicker()
    setStatus('paused')
  }, [stopTicker])

  const resume = useCallback(() => {
    recorderRef.current?.resume()
    setStatus('recording')
    tickerRef.current = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1000)
  }, [])

  return { status, elapsed, audioBlob, start, stop, pause, resume }
}
