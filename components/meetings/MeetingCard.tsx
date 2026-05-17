import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Meeting } from '@/lib/schemas/meeting.schema'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export interface MeetingCardProps {
  meeting: Meeting
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const isPending = meeting.id.startsWith('temp-')

  return (
    <Card role="article" aria-label={meeting.title}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{meeting.title}</CardTitle>
          {isPending && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Pending
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <div>{formatDate(meeting.date)}</div>
        <div>{formatDuration(meeting.durationSeconds)}</div>
        <div className="truncate">
          {meeting.participants.length} participant
          {meeting.participants.length === 1 ? '' : 's'}
        </div>
      </CardContent>
    </Card>
  )
}
