import { loginInputSchema, userSchema } from '@/lib/schemas/auth.schema'

describe('userSchema', () => {
  it('accepts a fully formed user', () => {
    expect(
      userSchema.safeParse({
        id: 'usr_1',
        email: 'alice@example.com',
        displayName: 'Alice',
      }).success,
    ).toBe(true)
  })

  it('rejects an empty id', () => {
    const result = userSchema.safeParse({
      id: '',
      email: 'alice@example.com',
      displayName: 'Alice',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = userSchema.safeParse({
      id: 'usr_1',
      email: 'not-an-email',
      displayName: 'Alice',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty displayName', () => {
    expect(
      userSchema.safeParse({
        id: 'usr_1',
        email: 'alice@example.com',
        displayName: '',
      }).success,
    ).toBe(false)
  })

  it('rejects a displayName over 80 chars', () => {
    expect(
      userSchema.safeParse({
        id: 'usr_1',
        email: 'alice@example.com',
        displayName: 'x'.repeat(81),
      }).success,
    ).toBe(false)
  })
})

describe('loginInputSchema', () => {
  it('accepts valid credentials', () => {
    expect(
      loginInputSchema.safeParse({
        email: 'alice@example.com',
        password: 'sixchars',
      }).success,
    ).toBe(true)
  })

  it('rejects an invalid email with a clear message', () => {
    const result = loginInputSchema.safeParse({
      email: 'not-an-email',
      password: 'sixchars',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email')
    }
  })

  it('rejects a password under 6 chars with a clear message', () => {
    const result = loginInputSchema.safeParse({
      email: 'alice@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Password must be at least 6 characters',
      )
    }
  })

  it('accepts exactly 6 characters (boundary)', () => {
    expect(
      loginInputSchema.safeParse({
        email: 'alice@example.com',
        password: '123456',
      }).success,
    ).toBe(true)
  })
})
