'use client'

import type { TranscriptionError } from '@/lib/fetchers/transcribe.fetcher'

export interface TranscriptionFallbackProps {
  error: TranscriptionError
  onRetry: () => void
  onManual: () => void
  onReRecord: () => void
}

const COPY: Record<TranscriptionError['kind'], { title: string; body: string }> = {
  NETWORK: {
    title: 'Could not transcribe the recording',
    body: 'The connection dropped before the transcript could come back. Retrying often works.',
  },
  PROVIDER: {
    title: 'Transcription failed',
    body: 'The transcription service hit an error. You can retry, type the transcript yourself, or record again.',
  },
  TOO_LARGE: {
    title: 'Recording is too long',
    body: 'This recording exceeds the maximum size (25 MB). Try a shorter recording, or enter the transcript manually.',
  },
  NO_SPEECH: {
    title: 'No speech detected',
    body: "We couldn't detect any spoken audio in the recording. Try recording again, or enter the transcript manually.",
  },
}

/**
 * Pure presentational fallback for a failed auto-transcription attempt.
 *
 * Per SC-004, every failure surface must offer both a retry and a manual-
 * entry path on the same screen. For `TOO_LARGE` and `NO_SPEECH`, retrying
 * with the same blob would just fail the same way, so the Retry button is
 * hidden — Re-record and Enter manually remain.
 */
export function TranscriptionFallback({
  error,
  onRetry,
  onManual,
  onReRecord,
}: TranscriptionFallbackProps) {
  const copy = COPY[error.kind]
  const canRetry = error.kind === 'NETWORK' || error.kind === 'PROVIDER'

  return (
    <div
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3.5"
    >
      <p className="text-sm font-medium text-danger">{copy.title}</p>
      <p className="mt-1 text-sm text-fg-2">{copy.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canRetry && (
          <button type="button" onClick={onRetry} className="btn-primary">
            Retry
          </button>
        )}
        <button type="button" onClick={onManual} className="btn-secondary">
          Enter manually
        </button>
        <button type="button" onClick={onReRecord} className="btn-ghost">
          Re-record
        </button>
      </div>
    </div>
  )
}
