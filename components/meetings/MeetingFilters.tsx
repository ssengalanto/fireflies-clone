'use client'

import { Search } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MeetingStatusFilter } from '@/lib/api/cacheKeys'
import { useMeetingStore } from '@/lib/store/meetingStore'

export function MeetingFilters() {
  const search = useMeetingStore((s) => s.filters.search)
  const status = useMeetingStore((s) => s.filters.status)
  const setFilter = useMeetingStore((s) => s.setFilter)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="relative flex flex-1 items-center">
        <Search
          className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-fg-muted"
          strokeWidth={1.75}
        />
        <input
          id="meeting-search"
          type="search"
          role="searchbox"
          aria-label="Search"
          placeholder="Search by title or participant"
          value={search}
          onChange={(e) => setFilter({ search: e.target.value })}
          className="h-9 w-full rounded-md border border-line bg-surface-1 pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-0"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="meeting-status" className="eyebrow shrink-0">
          Status
        </label>
        <Select
          value={status}
          onValueChange={(value) =>
            setFilter({ status: value as MeetingStatusFilter })
          }
        >
          <SelectTrigger
            id="meeting-status"
            aria-label="Status"
            className="h-9 w-[8rem] rounded-md border-line bg-surface-1 text-sm capitalize"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="recorded">Recorded</SelectItem>
            <SelectItem value="summarized">Summarized</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
