import { login } from '@/lib/fetchers/auth.fetcher'

function mockJson<T>(body: T, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response)
}

const user = {
  id: 'usr_1',
  email: 'alice@example.com',
  displayName: 'Alice',
}

beforeEach(() => {
  ;(global.fetch as jest.Mock) = jest.fn()
})

describe('login', () => {
  it('POSTs JSON to /api/auth/login and returns the User', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(mockJson(user))

    const result = await login({
      email: 'alice@example.com',
      password: 'sixchars',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    )
    const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'alice@example.com',
      password: 'sixchars',
    })
    expect(result).toEqual(user)
  })

  it('throws the server error message on !res.ok', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ error: 'Invalid email' }, false, 400),
    )
    await expect(
      login({ email: 'bad', password: 'sixchars' }),
    ).rejects.toThrow('Invalid email')
  })

  it('throws a default message when the server gives no JSON error body', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json')
        },
      } as unknown as Response),
    )
    await expect(
      login({ email: 'alice@example.com', password: 'sixchars' }),
    ).rejects.toThrow(/login/i)
  })
})
