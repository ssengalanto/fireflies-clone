/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/login/route'

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  it('returns 200 with a synthesised User on valid input', async () => {
    const res = await POST(
      jsonReq({ email: 'alice@example.com', password: 'sixchars' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toMatch(/^usr_/)
    expect(body.email).toBe('alice@example.com')
    expect(body.displayName).toBe('alice')
  })

  it('returns 400 on an invalid email', async () => {
    const res = await POST(
      jsonReq({ email: 'not-an-email', password: 'sixchars' }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid email')
  })

  it('returns 400 on a password under 6 characters', async () => {
    const res = await POST(
      jsonReq({ email: 'alice@example.com', password: 'short' }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Password must be at least 6 characters')
  })

  it('returns 400 on a malformed JSON body', async () => {
    const malformed = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    const res = await POST(malformed)
    expect(res.status).toBe(400)
  })

  it('returns a different id for each request (no shared user state)', async () => {
    const res1 = await POST(
      jsonReq({ email: 'alice@example.com', password: 'sixchars' }),
    )
    const res2 = await POST(
      jsonReq({ email: 'bob@example.com', password: 'sixchars' }),
    )
    const body1 = await res1.json()
    const body2 = await res2.json()
    expect(body1.id).not.toBe(body2.id)
  })
})
