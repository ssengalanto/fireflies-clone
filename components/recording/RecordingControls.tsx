'use client'

import { Mic, Square } from 'lucide-react'
import { useEffect } from 'react'

import { RecordingTimer } from '@/components/recording/RecordingTimer'
import { useRecording } from '@/lib/hooks/useRecording'

export interface RecordingControlsProps {
  onAudioBlob: (blob: Blob) => void
}

export function RecordingControls({ onAudioBlob }: RecordingControlsProps) {
  const { status, elapsed, audioBlob, start, stop } = useRecording()

  useEffect(() => {
    if (audioBlob) onAudioBlob(audioBlob)
  }, [audioBlob, onAudioBlob])

  const isRecording = status === 'recording'
  const isStopped = status === 'stopped'

  return (
    <div className="flex flex-wrap items-center gap-4">
      {isRecording ? (
        <>
          <button type="button" onClick={stop} className="btn-danger">
            <Square className="h-3 w-3 fill-current" strokeWidth={0} />
            Stop
          </button>
          <div className="flex items-center gap-2.5">
            <span className="record-dot" aria-hidden="true" />
            <RecordingTimer elapsed={elapsed} />
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => start()}
            className="btn-primary"
          >
            <Mic className="h-3.5 w-3.5" strokeWidth={1.75} />
            {isStopped ? 'Re-record' : 'Start recording'}
          </button>
          {isStopped && (
            <span className="flex items-center gap-2 text-xs text-fg-3">
              <span
                className="h-1.5 w-1.5 rounded-full bg-fg-muted"
                aria-hidden="true"
              />
              Stopped at <RecordingTimer elapsed={elapsed} />
            </span>
          )}
        </>
      )}
    </div>
  )
}
