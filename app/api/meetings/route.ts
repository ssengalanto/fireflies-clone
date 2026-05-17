import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createMeetingSchema } from '@/lib/schemas/meeting.schema'
import {
  create as createInStore,
  ensureSeeded,
  list as listFromStore,
} from '@/lib/server/meetingStore'

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['all', 'recorded', 'summarized']).optional(),
  cursor: z.string().optional(),
  limit: z
    .preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.number().int().min(1).max(100),
    )
    .optional(),
})

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid input'
}

export async function GET(req: Request) {
  await ensureSeeded()

  const url = new URL(req.url)
  const parsed = listQuerySchema.safeParse({
    search: url.searchParams.get('search') ?? undefined,
    status: (url.searchParams.get('status') as 'all' | 'recorded' | 'summarized' | null) ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 })
  }

  const page = listFromStore(parsed.data)
  return NextResponse.json(page, { status: 200 })
}

export async function POST(req: Request) {
  await ensureSeeded()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createMeetingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 })
  }

  const created = createInStore(parsed.data)
  return NextResponse.json(created, { status: 201 })
}
