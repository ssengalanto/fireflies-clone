'use client'

import { Button } from '@/components/ui/button'
import { useActionItems } from '@/lib/hooks/useActionItems'

const MIN_TRANSCRIPT_LENGTH = 50

export interface ActionItemsProps {
  meetingId: string
  transcript: string | null
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
      <section className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="text-destructive">
          Failed to extract action items: {error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => extract()}>
          Retry
        </Button>
      </section>
    )
  }

  if (data === undefined) {
    return (
      <Button onClick={() => extract()} disabled={isExtracting}>
        {isExtracting ? 'Extracting…' : 'Extract action items'}
      </Button>
    )
  }

  if (data.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Action items</h2>
        <p className="text-sm text-muted-foreground">
          No action items extracted.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Action items</h2>
      <ul className="space-y-2 text-sm">
        {data.map((item) => (
          <li key={item.id} className="rounded-md border p-3">
            <div>{item.text}</div>
            {(item.owner || item.dueDate) && (
              <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                {item.owner && <span>{item.owner}</span>}
                {item.owner && item.dueDate && <span>·</span>}
                {item.dueDate && (
                  <span>
                    Due{' '}
                    {new Intl.DateTimeFormat(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    }).format(new Date(item.dueDate))}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
