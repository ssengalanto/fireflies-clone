'use client'

import { useEffect } from 'react'

import { RecordingTimer } from '@/components/recording/RecordingTimer'
import { Button } from '@/components/ui/button'
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

  return (
    <div className="flex items-center gap-3">
      {isRecording ? (
        <>
          <Button type="button" variant="destructive" onClick={stop}>
            Stop
          </Button>
          <RecordingTimer elapsed={elapsed} />
        </>
      ) : (
        <Button type="button" onClick={() => start()}>
          {status === 'stopped' ? 'Re-record' : 'Start recording'}
        </Button>
      )}
    </div>
  )
}
