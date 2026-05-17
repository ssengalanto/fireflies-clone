import { NextResponse } from 'next/server'

import { loginInputSchema, type User } from '@/lib/schemas/auth.schema'

// Stub identity per R-011: any valid email + password ≥ 6 chars produces a
// synthesised user. There is no real password verification, no persistence
// of the credentials, and no token issuance — the soft gate's purpose is
// to give the dashboard a clear pre-login surface and to be the seam for a
// v2 swap to a real identity provider. The user's session lives entirely
// client-side in `authStore` (full-persist Zustand).
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = loginInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    )
  }

  const user: User = {
    id: `usr_${cryptoRandomId()}`,
    email: parsed.data.email,
    displayName: parsed.data.email.split('@')[0] || parsed.data.email,
  }
  return NextResponse.json(user, { status: 200 })
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 12)
}
