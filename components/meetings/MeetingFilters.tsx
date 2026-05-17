'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <Label htmlFor="meeting-search">Search</Label>
        <Input
          id="meeting-search"
          type="search"
          placeholder="Search by title or participant…"
          value={search}
          onChange={(e) => setFilter({ search: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="meeting-status">Status</Label>
        <Select
          value={status}
          onValueChange={(value) =>
            setFilter({ status: value as MeetingStatusFilter })
          }
        >
          <SelectTrigger id="meeting-status" className="w-40" aria-label="Status">
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
