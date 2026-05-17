'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMeeting } from '@/lib/hooks/useMeeting'
import { useTranscribeRecording } from '@/lib/hooks/useTranscribeRecording'
import { useUpdateTranscript } from '@/lib/hooks/useUpdateTranscript'

export interface TranscriptionReviewProps {
  meetingId: string
  audioBlob: Blob | null
  onSettled: () => void
}

/**
 * Orchestrates the auto-transcribe-and-save flow that runs after the user
 * stops a recording.
 *
 * Contract: the parent owns the `audioBlob` state (lifted out of
 * `RecordingControls`) and resets it via `onSettled()` after this component
 * finishes — success or failure. Each distinct `Blob` reference triggers
 * exactly one upload, gated on whether the meeting already has a transcript
 * (FR-005 replace-confirm).
 */
export function TranscriptionReview({
  meetingId,
  audioBlob,
  onSettled,
}: TranscriptionReviewProps) {
  const { data: meeting } = useMeeting(meetingId)
  const { trigger: transcribe, isMutating } = useTranscribeRecording(meetingId)
  const { trigger: save } = useUpdateTranscript(meetingId)

  // Tracks which Blob reference we've already started processing so a
  // re-render with the same `audioBlob` prop doesn't fire a second upload.
  const processedRef = useRef<Blob | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)

  const runUpload = useCallback(
    async (blob: Blob) => {
      try {
        const result = await transcribe(blob)
        await save(result.transcript)
      } finally {
        onSettled()
      }
    },
    [transcribe, save, onSettled],
  )

  useEffect(() => {
    if (!audioBlob) return
    if (processedRef.current === audioBlob) return
    processedRef.current = audioBlob

    const existing = meeting?.transcript?.trim() ?? ''
    if (existing.length > 0) {
      setPendingBlob(audioBlob)
      return
    }
    void runUpload(audioBlob)
  }, [audioBlob, meeting?.transcript, runUpload])

  const onReplace = () => {
    const blob = pendingBlob
    setPendingBlob(null)
    if (blob) void runUpload(blob)
  }

  const onKeepCurrent = () => {
    setPendingBlob(null)
    onSettled()
  }

  return (
    <>
      {isMutating && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border border-line bg-surface-1 px-4 py-3 text-sm text-fg-3"
        >
          <span className="record-dot" aria-hidden="true" />
          Transcribing recording…
        </div>
      )}

      <Dialog
        open={pendingBlob !== null}
        onOpenChange={(open) => {
          if (!open) onKeepCurrent()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing transcript?</DialogTitle>
            <DialogDescription>
              This meeting already has a transcript. Recording over it will
              replace the saved text with the new transcription.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={onKeepCurrent}
              className="btn-ghost"
            >
              Keep current
            </button>
            <button
              type="button"
              onClick={onReplace}
              className="btn-primary"
            >
              Replace
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
