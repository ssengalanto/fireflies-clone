import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LoginForm } from '@/components/auth/LoginForm'
import { login } from '@/lib/fetchers/auth.fetcher'

import { resetStores } from '../../utils/stores'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}))

jest.mock('@/lib/fetchers/auth.fetcher')
const mockLogin = login as jest.MockedFunction<typeof login>

beforeEach(() => {
  resetStores()
  mockLogin.mockReset()
  mockReplace.mockReset()
})

describe('<LoginForm />', () => {
  it('renders email and password fields and a Sign in button', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('submits valid credentials, calls login, and triggers the redirect', async () => {
    mockLogin.mockResolvedValue({
      id: 'usr_1',
      email: 'alice@example.com',
      displayName: 'alice',
    })

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'sixchars')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'sixchars',
    })
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('renders a field-level error from zod (short password)', async () => {
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText(/password must be at least 6 characters/i),
    ).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('renders the server error message on a failed login', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'sixchars')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText(/invalid credentials/i),
    ).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
