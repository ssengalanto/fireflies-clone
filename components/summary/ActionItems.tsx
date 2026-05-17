'use client'

import { ListChecks } from 'lucide-react'

import { useActionItems } from '@/lib/hooks/useActionItems'

const MIN_TRANSCRIPT_LENGTH = 50

export interface ActionItemsProps {
  meetingId: string
  transcript: string | null
}

function formatDue(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))
}

export function ActionItems({ meetingId, transcript }: ActionItemsProps) {
  const { data, extract, isExtracting, error } = useActionItems(
    meetingId,
    transcript,
  )

  if (!transcript || transcript.length < MIN_TRANSCRIPT_LENGTH) {
    return null
  }

  if (error) {
    return (
      <section className="reveal reveal-4 space-y-3">
        <div className="flex items-baseline gap-3">
          <p className="eyebrow !text-danger">Action items · error</p>
          <div className="h-px flex-1 bg-danger/30" />
        </div>
        <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3.5">
          <p className="text-sm text-fg">
            Couldn&rsquo;t extract action items: {error.message}
          </p>
          <button
            type="button"
            onClick={() => extract()}
            className="btn-secondary mt-3"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (data === undefined) {
    return (
      <section className="reveal reveal-4 space-y-3">
        <div className="flex items-baseline gap-3">
          <p className="eyebrow">Action items</p>
          <div className="h-px flex-1 bg-line" />
        </div>
        <div className="rounded-md border border-dashed border-line-strong px-6 py-8 text-center">
          <ListChecks
            className="mx-auto h-4 w-4 text-accent"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-medium text-fg">
            Extract action items
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-fg-3">
            Structured list of follow-ups. Owners and due dates where the
            conversation made them clear.
          </p>
          <button
            type="button"
            onClick={() => extract()}
            disabled={isExtracting}
            className="btn-primary mt-4"
          >
            {isExtracting ? 'Extracting…' : 'Extract action items'}
          </button>
        </div>
      </section>
    )
  }

  if (data.length === 0) {
    return (
      <section className="reveal reveal-4 space-y-3">
        <div className="flex items-baseline gap-3">
          <p className="eyebrow">Action items</p>
          <div className="h-px flex-1 bg-line" />
        </div>
        <p className="text-sm text-fg-muted">No action items extracted.</p>
      </section>
    )
  }

  return (
    <section className="reveal reveal-4 space-y-3">
      <div className="flex items-baseline gap-3">
        <p className="eyebrow">Action items</p>
        <div className="h-px flex-1 bg-line" />
        <p className="num text-xs text-fg-muted">
          {data.length.toString().padStart(2, '0')}
        </p>
      </div>
      <ul className="overflow-hidden rounded-md border border-line">
        {data.map((item, index) => (
          <li
            key={item.id}
            className="group grid grid-cols-[2rem_1fr] items-baseline gap-x-3 border-b border-line bg-card px-4 py-3 last:border-b-0 hover:bg-surface-1"
          >
            <span
              className="num text-xs font-medium text-fg-muted transition-colors group-hover:text-accent"
              aria-hidden="true"
            >
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <div className="space-y-0.5">
              <p className="text-pretty text-sm leading-snug text-fg">
                {item.text}
              </p>
              {(item.owner || item.dueDate) && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {item.owner && (
                    <span className="text-fg-3">{item.owner}</span>
                  )}
                  {item.owner && item.dueDate && (
                    <span aria-hidden="true" className="text-fg-muted/50">
                      ·
                    </span>
                  )}
                  {item.dueDate && (
                    <span className="num text-accent">
                      Due {formatDue(item.dueDate)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
