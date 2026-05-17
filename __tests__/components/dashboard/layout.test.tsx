import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DashboardLayout from '@/app/(dashboard)/layout'
import type { User } from '@/lib/schemas/auth.schema'
import { useAuthStore } from '@/lib/store/authStore'

import { resetStores } from '../../utils/stores'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}))

const alice: User = {
  id: 'usr_1',
  email: 'alice@example.com',
  displayName: 'Alice',
}

beforeEach(() => {
  resetStores()
  mockReplace.mockReset()
})

describe('<DashboardLayout />', () => {
  it('redirects to /login when not authenticated', async () => {
    render(<DashboardLayout>dashboard children</DashboardLayout>)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('does NOT render the dashboard chrome when unauthenticated (avoids briefly leaking content)', () => {
    render(<DashboardLayout>dashboard children</DashboardLayout>)
    expect(screen.queryByText(/dashboard children/i)).not.toBeInTheDocument()
  })

  it('renders the children when authenticated; no redirect', async () => {
    act(() => useAuthStore.getState().setUser(alice))
    render(<DashboardLayout>dashboard children</DashboardLayout>)

    expect(screen.getByText(/dashboard children/i)).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('renders a Sign out button when authenticated', () => {
    act(() => useAuthStore.getState().setUser(alice))
    render(<DashboardLayout>dashboard children</DashboardLayout>)
    // Both the desktop spine and the mobile top-bar each render a sign-out
    // affordance; CSS hides one or the other per viewport. At least one
    // must be in the DOM.
    const buttons = screen.getAllByRole('button', { name: /sign out/i })
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('Sign out clears the auth state and redirects to /login', async () => {
    act(() => useAuthStore.getState().setUser(alice))
    render(<DashboardLayout>dashboard children</DashboardLayout>)

    const buttons = screen.getAllByRole('button', { name: /sign out/i })
    await userEvent.click(buttons[0])

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(mockReplace).toHaveBeenCalledWith('/login')
  })
})
