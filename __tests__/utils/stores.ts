import { useUIStore } from '@/lib/store/uiStore'

/**
 * Reset every Zustand store touched by the suite to its known initial state.
 * Call from `beforeEach`, not `beforeAll` — `beforeAll` only fires once and
 * lets later tests inherit dirty state from earlier ones.
 *
 * Extended per-story as more stores land:
 * - US1 adds `useMeetingStore` (T032).
 * - US5 adds `useAuthStore`   (T108).
 */
export function resetStores(): void {
  useUIStore.setState({
    sidebarOpen: true,
    activeModal: null,
    modalPayload: null,
  })
}
