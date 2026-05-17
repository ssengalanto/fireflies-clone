'use client'

import Link from 'next/link'

import { RecordingControls } from '@/components/recording/RecordingControls'
import { ActionItems } from '@/components/summary/ActionItems'
import { SummaryView } from '@/components/summary/SummaryView'
import { TranscriptEditor } from '@/components/transcript/TranscriptEditor'
import { TranscriptView } from '@/components/transcript/TranscriptView'
import { Skeleton } from '@/components/ui/skeleton'
import { useMeeting } from '@/lib/hooks/useMeeting'

export default function MeetingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: meeting, error, isLoading } = useMeeting(params.id)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-2xl font-semibold">Meeting unavailable</h1>
        <p className="text-sm text-muted-foreground">
          {(error as Error).message}
        </p>
        <Link href="/" className="text-sm underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (!meeting) return null

  const hasTranscript =
    meeting.transcript !== null && meeting.transcript.trim().length > 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <Link
          href="/"
          className="text-xs text-muted-foreground underline"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {meeting.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(meeting.date))}{' '}
          · {meeting.participants.join(', ')}
        </p>
      </header>

      {!hasTranscript ? (
        <section className="space-y-4 rounded-md border p-4">
          <h2 className="text-sm font-medium">Capture this meeting</h2>
          <RecordingControls
            onAudioBlob={() => {
              /* v1: the audio blob is unused; the transcript is supplied manually below. */
            }}
          />
          <TranscriptEditor meetingId={meeting.id} />
        </section>
      ) : (
        <section className="space-y-6">
          <TranscriptView transcript={meeting.transcript} />
          <SummaryView
            meetingId={meeting.id}
            transcript={meeting.transcript}
          />
          <ActionItems
            meetingId={meeting.id}
            transcript={meeting.transcript}
          />
        </section>
      )}
    </div>
  )
}
