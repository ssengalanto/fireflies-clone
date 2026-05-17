import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { User } from '@/lib/schemas/auth.schema'

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User) => void
  clearAuth: () => void
}

// Full persist — both `user` and `isAuthenticated` are needed across reloads
// (FR-020). No `partialize` exclusions; the auth session is the whole story.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearAuth: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'fireflies/auth-store',
    },
  ),
)
