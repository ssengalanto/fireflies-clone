'use client'

import { Sparkles } from 'lucide-react'

import { useSummary, useSummaryStream } from '@/lib/hooks/useSummary'

const MIN_TRANSCRIPT_LENGTH = 50

export interface SummaryViewProps {
  meetingId: string
  transcript: string | null
}

export function SummaryView({ meetingId, transcript }: SummaryViewProps) {
  const { data: cached } = useSummary(meetingId)

  if (!transcript || transcript.length < MIN_TRANSCRIPT_LENGTH) {
    return null
  }

  if (cached) {
    return (
      <section className="reveal reveal-3 space-y-3">
        <div className="flex items-baseline gap-3">
          <p className="eyebrow">Summary</p>
          <div className="h-px flex-1 bg-line" />
        </div>
        <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-fg">
          {cached}
        </p>
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
      <section className="reveal reveal-3 space-y-3">
        <div className="flex items-baseline gap-3">
          <p className="eyebrow !text-danger">Summary · error</p>
          <div className="h-px flex-1 bg-danger/30" />
        </div>
        <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3.5">
          <p className="text-sm text-fg">
            Couldn&rsquo;t generate the summary: {error.message}
          </p>
          <button
            type="button"
            onClick={() => generate()}
            className="btn-secondary mt-3"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (isStreaming || text.length > 0) {
    return (
      <section className="reveal reveal-3 space-y-3">
        <div className="flex items-baseline gap-3">
          <p className="eyebrow">
            Summary
            {isStreaming && (
              <span
                aria-live="polite"
                className="ml-2 inline-flex items-center gap-1.5 text-accent"
              >
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                  aria-hidden="true"
                />
                <span>generating</span>
              </span>
            )}
          </p>
          <div className="h-px flex-1 bg-line" />
        </div>
        <p
          className={`whitespace-pre-wrap text-pretty text-sm leading-relaxed text-fg ${
            isStreaming ? 'streaming-cursor' : ''
          }`}
        >
          {text}
        </p>
      </section>
    )
  }

  return (
    <section className="reveal reveal-3 space-y-3">
      <div className="flex items-baseline gap-3">
        <p className="eyebrow">Summary</p>
        <div className="h-px flex-1 bg-line" />
      </div>
      <div className="rounded-md border border-dashed border-line-strong px-6 py-8 text-center">
        <Sparkles
          className="mx-auto h-4 w-4 text-accent"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium text-fg">
          Generate a summary
        </p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-fg-3">
          A short prose summary of the meeting&rsquo;s decisions and topics.
          Streams in live.
        </p>
        <button
          type="button"
          onClick={() => generate()}
          className="btn-primary mt-4"
        >
          Generate summary
        </button>
      </div>
    </section>
  )
}
