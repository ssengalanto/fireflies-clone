import { create } from 'zustand'

export interface UIState {
  sidebarOpen: boolean
  activeModal: string | null
  modalPayload: unknown
  toggleSidebar: () => void
  openModal: (name: string, payload?: unknown) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  modalPayload: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openModal: (name, payload) =>
    set({ activeModal: name, modalPayload: payload ?? null }),
  closeModal: () => set({ activeModal: null, modalPayload: null }),
}))
