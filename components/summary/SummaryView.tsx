'use client'

import { Button } from '@/components/ui/button'
import { useSummary, useSummaryStream } from '@/lib/hooks/useSummary'

const MIN_TRANSCRIPT_LENGTH = 50

export interface SummaryViewProps {
  meetingId: string
  transcript: string | null
}

export function SummaryView({ meetingId, transcript }: SummaryViewProps) {
  // Always read the cache so the hook order is stable across renders.
  const { data: cached } = useSummary(meetingId)

  if (!transcript || transcript.length < MIN_TRANSCRIPT_LENGTH) {
    return null
  }

  if (cached) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Summary</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{cached}</p>
      </section>
    )
  }

  return <SummaryGenerator meetingId={meetingId} transcript={transcript} />
}

function SummaryGenerator({
  meetingId,
  transcript,
}: {
  meetingId: string
  transcript: string
}) {
  const { text, isStreaming, error, generate } = useSummaryStream(
    meetingId,
    transcript,
  )

  if (error) {
    return (
      <section className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="text-destructive">
          Failed to generate summary: {error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => generate()}>
          Retry
        </Button>
      </section>
    )
  }

  if (isStreaming || text.length > 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Summary {isStreaming && <span aria-live="polite">(generating…)</span>}
        </h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      </section>
    )
  }

  return (
    <Button onClick={() => generate()}>Generate summary</Button>
  )
}
