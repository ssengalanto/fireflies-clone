import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { MeetingFilters } from '@/lib/api/cacheKeys'
import type { CreateMeetingInput } from '@/lib/schemas/meeting.schema'

export const DEFAULT_MEETING_FILTERS: MeetingFilters = {
  search: '',
  status: 'all',
}

export interface MeetingStoreState {
  selectedIds: string[]
  filters: MeetingFilters
  meetingDraft: Partial<CreateMeetingInput> | null
  wizardStep: number

  selectMeeting: (id: string) => void
  deselectMeeting: (id: string) => void
  clearSelection: () => void

  setFilter: (patch: Partial<MeetingFilters>) => void
  resetFilters: () => void

  setMeetingDraft: (draft: Partial<CreateMeetingInput> | null) => void
  clearMeetingDraft: () => void

  nextStep: () => void
  prevStep: () => void
  resetWizard: () => void
}

export const useMeetingStore = create<MeetingStoreState>()(
  persist(
    (set) => ({
      selectedIds: [],
      filters: { ...DEFAULT_MEETING_FILTERS },
      meetingDraft: null,
      wizardStep: 0,

      selectMeeting: (id) =>
        set((s) =>
          s.selectedIds.includes(id)
            ? s
            : { ...s, selectedIds: [...s.selectedIds, id] },
        ),
      deselectMeeting: (id) =>
        set((s) => ({
          ...s,
          selectedIds: s.selectedIds.filter((x) => x !== id),
        })),
      clearSelection: () => set({ selectedIds: [] }),

      setFilter: (patch) =>
        set((s) => ({ ...s, filters: { ...s.filters, ...patch } })),
      resetFilters: () => set({ filters: { ...DEFAULT_MEETING_FILTERS } }),

      setMeetingDraft: (draft) => set({ meetingDraft: draft }),
      clearMeetingDraft: () => set({ meetingDraft: null }),

      nextStep: () => set((s) => ({ ...s, wizardStep: s.wizardStep + 1 })),
      prevStep: () =>
        set((s) => ({ ...s, wizardStep: Math.max(0, s.wizardStep - 1) })),
      resetWizard: () => set({ wizardStep: 0 }),
    }),
    {
      name: 'fireflies/meeting-store',
      // Only persist what survives a reload usefully — stale selections and
      // mid-wizard state confuse the user on a fresh tab, so they're excluded.
      partialize: (state) => ({
        filters: state.filters,
        meetingDraft: state.meetingDraft,
      }),
    },
  ),
)
