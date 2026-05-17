'use client'

import Link from 'next/link'

import { MeetingCard } from '@/components/meetings/MeetingCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMeetings } from '@/lib/hooks/useMeetings'

export function MeetingList() {
  const { data, error, isLoading, isValidating, size, setSize } = useMeetings()

  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load meetings: {(error as Error).message}
      </div>
    )
  }

  const items = data?.flatMap((page) => page.items) ?? []
  const lastPage = data?.[data.length - 1]
  const hasMore = !!lastPage?.nextCursor

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No meetings yet.</p>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((m) => (
        <Link key={m.id} href={`/meetings/${m.id}`} className="block">
          <MeetingCard meeting={m} />
        </Link>
      ))}
      {hasMore && (
        <Button
          variant="outline"
          onClick={() => setSize(size + 1)}
          disabled={isValidating}
        >
          {isValidating ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
