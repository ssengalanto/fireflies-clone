'use client'

import { Plus } from 'lucide-react'

import { MeetingFilters } from '@/components/meetings/MeetingFilters'
import { MeetingList } from '@/components/meetings/MeetingList'
import { NewMeetingModal } from '@/components/meetings/NewMeetingModal'
import { useUIStore } from '@/lib/store/uiStore'

export default function DashboardPage() {
  const openModal = useUIStore((s) => s.openModal)

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 md:px-10 md:py-12">
      <header className="reveal reveal-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="eyebrow">Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Meetings
          </h1>
          <p className="max-w-md text-sm text-fg-3">
            Capture audio, supply the transcript, let the model distill the
            rest.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal('new-meeting')}
          className="btn-primary self-start"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New meeting
        </button>
      </header>

      <div className="reveal reveal-2 mt-8">
        <MeetingFilters />
      </div>

      <section className="reveal reveal-3 mt-6">
        <MeetingList />
      </section>

      <NewMeetingModal />
    </div>
  )
}
