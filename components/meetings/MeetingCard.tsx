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

const STATUS_LABEL: Record<Meeting['status'], string> = {
  draft: 'Draft',
  recorded: 'Recorded',
  summarized: 'Summarized',
}

const STATUS_DOT: Record<Meeting['status'], string> = {
  draft: 'bg-fg-muted/50',
  recorded: 'bg-fg-2',
  summarized: 'bg-accent',
}

export interface MeetingCardProps {
  meeting: Meeting
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const isPending = meeting.id.startsWith('temp-')

  return (
    <article
      role="article"
      aria-label={meeting.title}
      className="data-row group rounded-md"
    >
      {/* Left — date / duration in mono */}
      <div className="flex shrink-0 flex-col gap-0.5 text-right md:w-32">
        <p className="num text-xs text-fg-2">{formatDate(meeting.date)}</p>
        <p className="num text-xs text-fg-muted">
          {formatDuration(meeting.durationSeconds)}
        </p>
      </div>

      {/* Middle — title + participants */}
      <div className="min-w-0">
        <h2 className="truncate text-sm font-medium tracking-tight text-fg transition-colors group-hover:text-accent">
          {meeting.title}
        </h2>
        <p className="mt-0.5 truncate text-xs text-fg-3">
          {meeting.participants.slice(0, 3).join(' · ')}
          {meeting.participants.length > 3 && (
            <span className="text-fg-muted/70">
              {' '}
              + {meeting.participants.length - 3} more
            </span>
          )}
        </p>
      </div>

      {/* Right — status pill (small dot + label) */}
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        {isPending ? (
          <>
            <span className="record-dot !h-1.5 !w-1.5" aria-hidden="true" />
            <span className="eyebrow !text-danger">Pending</span>
          </>
        ) : (
          <>
            <span
              className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[meeting.status]}`}
              aria-hidden="true"
            />
            <span className="eyebrow">{STATUS_LABEL[meeting.status]}</span>
          </>
        )}
      </div>
    </article>
  )
}
