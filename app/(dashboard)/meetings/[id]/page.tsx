'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { RecordingControls } from '@/components/recording/RecordingControls'
import { ActionItems } from '@/components/summary/ActionItems'
import { SummaryView } from '@/components/summary/SummaryView'
import { TranscriptEditor } from '@/components/transcript/TranscriptEditor'
import { TranscriptionReview } from '@/components/transcript/TranscriptionReview'
import { TranscriptView } from '@/components/transcript/TranscriptView'
import { useMeeting } from '@/lib/hooks/useMeeting'

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export default function MeetingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: meeting, error, isLoading } = useMeeting(params.id)
  const [pendingAudio, setPendingAudio] = useState<Blob | null>(null)
  const [recorderEpoch, setRecorderEpoch] = useState(0)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-10 md:px-10 md:py-12">
        <div className="skeleton-shimmer h-3 w-24" />
        <div className="skeleton-shimmer h-8 w-2/3" />
        <div className="skeleton-shimmer h-4 w-1/2" />
        <div className="skeleton-shimmer mt-6 h-40 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-10 md:px-10 md:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-fg-3 transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back
        </Link>
        <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3.5">
          <p className="text-sm font-medium text-danger">Meeting unavailable</p>
          <p className="mt-1 text-sm text-fg-2">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  if (!meeting) return null

  const hasTranscript =
    meeting.transcript !== null && meeting.transcript.trim().length > 0

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-12">
      <Link
        href="/"
        className="reveal reveal-1 inline-flex items-center gap-1.5 text-sm text-fg-3 transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back
      </Link>

      <header className="reveal reveal-2 mt-6 space-y-3">
        <p className="eyebrow num">
          {formatLongDate(meeting.date)}
          {meeting.durationSeconds > 0 && (
            <span className="text-fg-muted/70">
              {' · '}
              {formatDuration(meeting.durationSeconds)}
            </span>
          )}
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-fg md:text-3xl">
          {meeting.title}
        </h1>
        <p className="text-sm text-fg-3">
          {meeting.participants.join(' · ')}
        </p>
        <div className="hairline mt-5" />
      </header>

      {!hasTranscript ? (
        <section className="reveal reveal-3 mt-8 space-y-6">
          <div className="space-y-1.5">
            <p className="eyebrow">Step 1</p>
            <h2 className="text-lg font-semibold tracking-tight text-fg">
              Capture this meeting
            </h2>
            <p className="text-sm text-fg-3">
              Press record while the conversation happens. When you stop, paste
              or type the transcript below — the model will do the rest.
            </p>
          </div>

          <div className="rounded-md border border-line bg-surface-1 px-5 py-5">
            <RecordingControls
              key={recorderEpoch}
              onAudioBlob={setPendingAudio}
            />
          </div>

          <TranscriptionReview
            meetingId={meeting.id}
            audioBlob={pendingAudio}
            onSettled={() => setPendingAudio(null)}
            onReRecord={() => {
              setPendingAudio(null)
              setRecorderEpoch((e) => e + 1)
            }}
          />

          <TranscriptEditor meetingId={meeting.id} />
        </section>
      ) : (
        <div className="mt-8 space-y-10">
          <SummaryView
            meetingId={meeting.id}
            transcript={meeting.transcript}
          />
          <ActionItems
            meetingId={meeting.id}
            transcript={meeting.transcript}
          />
          <section className="reveal reveal-5 space-y-3">
            <div className="flex items-center gap-3">
              <p className="eyebrow">Transcript</p>
              <div className="h-px flex-1 bg-line" />
            </div>
            <TranscriptView transcript={meeting.transcript} />
          </section>
        </div>
      )}
    </div>
  )
}
