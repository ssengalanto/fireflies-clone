import type { LoginInput, User } from '@/lib/schemas/auth.schema'

export async function login(input: LoginInput): Promise<User> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    let message = 'Login failed'
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // body wasn't JSON; fall back to the default message
    }
    throw new Error(message)
  }

  return (await res.json()) as User
}
