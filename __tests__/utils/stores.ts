import {
  DEFAULT_MEETING_FILTERS,
  useMeetingStore,
} from '@/lib/store/meetingStore'
import { useUIStore } from '@/lib/store/uiStore'

/**
 * Reset every Zustand store touched by the suite to its known initial state.
 * Call from `beforeEach`, not `beforeAll` — `beforeAll` only fires once and
 * lets later tests inherit dirty state from earlier ones.
 *
 * Extended per-story as more stores land:
 * - US5 adds `useAuthStore` (T108).
 */
export function resetStores(): void {
  useUIStore.setState({
    sidebarOpen: true,
    activeModal: null,
    modalPayload: null,
  })

  useMeetingStore.setState({
    selectedIds: [],
    filters: { ...DEFAULT_MEETING_FILTERS },
    meetingDraft: null,
    wizardStep: 0,
  })
}
