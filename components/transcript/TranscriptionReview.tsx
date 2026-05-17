'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { TranscriptEditor } from '@/components/transcript/TranscriptEditor'
import { TranscriptionFallback } from '@/components/transcript/TranscriptionFallback'
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

export interface TranscriptionReviewProps {
  meetingId: string
  audioBlob: Blob | null
  onSettled: () => void
  onReRecord?: () => void
}

/**
 * Orchestrates the auto-transcribe → review → save flow that runs after
 * the user stops a recording.
 *
 * Contract: the parent owns the `audioBlob` state (lifted out of
 * `RecordingControls`) and resets it via `onSettled()` after the user
 * confirms the produced transcript through `TranscriptEditor`'s Save
 * button. Each distinct `Blob` reference triggers exactly one upload,
 * gated on whether the meeting already has a transcript (FR-005
 * replace-confirm).
 *
 * Per US2: the auto-produced text is *not* committed to the meeting until
 * the user clicks Save. If the user navigates away without saving, the
 * produced text is discarded.
 *
 * Per US3: when the upload fails, a `TranscriptionFallback` is rendered
 * instead of the editor. The user picks Retry, Enter manually, or
 * Re-record. The optional `onReRecord` prop lets the parent reset the
 * recording subtree back to idle; when omitted, Re-record degrades to
 * `onSettled` (which at least clears the pending blob).
 */
export function TranscriptionReview({
  meetingId,
  audioBlob,
  onSettled,
  onReRecord,
}: TranscriptionReviewProps) {
  const { data: meeting } = useMeeting(meetingId)
  const { trigger: transcribe, isMutating, error, reset } =
    useTranscribeRecording(meetingId)

  const processedRef = useRef<Blob | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [producedText, setProducedText] = useState<string | null>(null)
  // Lets the user re-open an empty editor after picking "Enter manually"
  // from the failure fallback (US3 fallback path).
  const [manualMode, setManualMode] = useState(false)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const runUpload = useCallback(
    async (blob: Blob) => {
      try {
        const result = await transcribe(blob)
        if (mountedRef.current) setProducedText(result.transcript)
      } catch {
        // The hook stores the typed error; the render below picks it up
        // and shows the fallback. No need to do anything here.
      }
    },
    [transcribe],
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

  const onSaved = () => {
    setProducedText(null)
    setManualMode(false)
    onSettled()
  }

  const onRetry = () => {
    reset()
    if (audioBlob) void runUpload(audioBlob)
  }

  const onManual = () => {
    reset()
    setManualMode(true)
  }

  const onReRecordClick = () => {
    reset()
    setProducedText(null)
    setManualMode(false)
    if (onReRecord) onReRecord()
    else onSettled()
  }

  const showFallback = error !== undefined && !manualMode
  const showEditor =
    !showFallback && (producedText !== null || manualMode)
  const editorInitialValue = manualMode ? '' : producedText ?? ''

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

      {showFallback && (
        <TranscriptionFallback
          error={error}
          onRetry={onRetry}
          onManual={onManual}
          onReRecord={onReRecordClick}
        />
      )}

      {showEditor && (
        <TranscriptEditor
          meetingId={meetingId}
          initialValue={editorInitialValue}
          onSaved={onSaved}
        />
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
