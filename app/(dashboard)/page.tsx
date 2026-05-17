'use client'

import { MeetingFilters } from '@/components/meetings/MeetingFilters'
import { MeetingList } from '@/components/meetings/MeetingList'
import { NewMeetingModal } from '@/components/meetings/NewMeetingModal'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/lib/store/uiStore'

export default function DashboardPage() {
  const openModal = useUIStore((s) => s.openModal)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        <Button onClick={() => openModal('new-meeting')}>New meeting</Button>
      </header>
      <MeetingFilters />
      <MeetingList />
      <NewMeetingModal />
    </div>
  )
}
