import { act, renderHook, waitFor } from '@testing-library/react'

import { login } from '@/lib/fetchers/auth.fetcher'
import { useLoginForm } from '@/lib/hooks/useLoginForm'
import { useAuthStore } from '@/lib/store/authStore'

import { resetStores } from '../utils/stores'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
  }),
}))

jest.mock('@/lib/fetchers/auth.fetcher')
const mockLogin = login as jest.MockedFunction<typeof login>

const user = {
  id: 'usr_1',
  email: 'alice@example.com',
  displayName: 'alice',
}

beforeEach(() => {
  resetStores()
  mockLogin.mockReset()
  mockReplace.mockReset()
})

describe('useLoginForm', () => {
  it('starts idle (not pending, no error, no user in authStore)', () => {
    const { result } = renderHook(() => useLoginForm())
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('blocks invalid submit (short password) and does not call login', async () => {
    mockLogin.mockResolvedValue(user)
    const { result } = renderHook(() => useLoginForm())

    act(() => result.current.form.setValue('email', 'alice@example.com'))
    act(() => result.current.form.setValue('password', 'short'))

    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mockLogin).not.toHaveBeenCalled()

    let isValid: boolean | undefined
    await act(async () => {
      isValid = await result.current.form.trigger()
    })
    expect(isValid).toBe(false)
  })

  it('valid submit calls login, then setUser, then router.replace("/")', async () => {
    mockLogin.mockResolvedValue(user)
    const { result } = renderHook(() => useLoginForm())

    act(() => result.current.form.setValue('email', 'alice@example.com'))
    act(() => result.current.form.setValue('password', 'sixchars'))

    await act(async () => {
      await result.current.onSubmit()
    })

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'sixchars',
    })
    expect(useAuthStore.getState().user).toEqual(user)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('captures the fetcher error via the error state; no auth or redirect', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))
    const { result } = renderHook(() => useLoginForm())

    act(() => result.current.form.setValue('email', 'alice@example.com'))
    act(() => result.current.form.setValue('password', 'sixchars'))

    await act(async () => {
      await result.current.onSubmit()
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    expect((result.current.error as Error).message).toBe('Invalid credentials')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
