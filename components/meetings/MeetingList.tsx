'use client'

import Link from 'next/link'

import { MeetingCard } from '@/components/meetings/MeetingCard'
import { useMeetings } from '@/lib/hooks/useMeetings'
import { useMeetingStore } from '@/lib/store/meetingStore'

export function MeetingList() {
  const { data, error, isLoading, isValidating, size, setSize } = useMeetings()
  const filters = useMeetingStore((s) => s.filters)
  const hasActiveFilters =
    filters.search.trim().length > 0 || filters.status !== 'all'

  if (isLoading && !data) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            role="status"
            aria-busy="true"
            className="skeleton-shimmer h-[64px] w-full"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3.5">
        <p className="text-sm font-medium text-danger">
          Couldn&rsquo;t load meetings
        </p>
        <p className="mt-1 text-sm text-fg-2">{(error as Error).message}</p>
      </div>
    )
  }

  const items = data?.flatMap((page) => page.items) ?? []
  const lastPage = data?.[data.length - 1]
  const hasMore = !!lastPage?.nextCursor

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line-strong px-6 py-12 text-center">
        <p className="text-sm font-medium text-fg-2">
          {hasActiveFilters
            ? 'No meetings match your filters.'
            : 'No meetings yet.'}
        </p>
        <p className="mt-1.5 text-xs text-fg-3">
          {hasActiveFilters
            ? 'Adjust the filters above, or clear them.'
            : 'Use the New meeting button to capture your first.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id} className="reveal reveal-3">
            <Link
              href={`/meetings/${m.id}`}
              className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <MeetingCard meeting={m} />
            </Link>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setSize(size + 1)}
            disabled={isValidating}
            className="btn-secondary"
          >
            {isValidating ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
