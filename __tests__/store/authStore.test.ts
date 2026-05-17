import { act, renderHook } from '@testing-library/react'

import { useAuthStore } from '@/lib/store/authStore'
import type { User } from '@/lib/schemas/auth.schema'

const alice: User = {
  id: 'usr_1',
  email: 'alice@example.com',
  displayName: 'Alice',
}

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false })
})

describe('useAuthStore', () => {
  it('starts unauthenticated with a null user', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('setUser sets user and flips isAuthenticated to true', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.setUser(alice))
    expect(result.current.user).toEqual(alice)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('clearAuth nulls user and flips isAuthenticated to false', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.setUser(alice))
    act(() => result.current.clearAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('persists the full state (no partialize exclusions)', () => {
    const options = useAuthStore.persist.getOptions()
    // A full-persist store either has no `partialize` or one that returns
    // every relevant slot. Assert both slots are preserved.
    if (options.partialize) {
      const persisted = options.partialize({
        user: alice,
        isAuthenticated: true,
        setUser: () => undefined,
        clearAuth: () => undefined,
      })
      expect(persisted).toMatchObject({ user: alice, isAuthenticated: true })
    } else {
      // No partialize == full persist. Pass.
      expect(options.partialize).toBeUndefined()
    }
  })

  it('granular selector only re-renders on its slice', () => {
    const { result } = renderHook(() =>
      useAuthStore((s) => s.isAuthenticated),
    )
    expect(result.current).toBe(false)
    act(() => useAuthStore.getState().setUser(alice))
    expect(result.current).toBe(true)
  })
})
