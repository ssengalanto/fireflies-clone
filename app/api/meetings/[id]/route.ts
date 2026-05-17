import { NextResponse } from 'next/server'
import { z } from 'zod'

import { updateTranscriptSchema } from '@/lib/schemas/transcript.schema'
import {
  ensureSeeded,
  get as getFromStore,
  remove as removeFromStore,
  update as updateInStore,
} from '@/lib/server/meetingStore'

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid input'
}

interface RouteContext {
  params: { id: string }
}

export async function GET(_req: Request, { params }: RouteContext) {
  await ensureSeeded()
  const meeting = getFromStore(params.id)
  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }
  return NextResponse.json(meeting, { status: 200 })
}

export async function PATCH(req: Request, { params }: RouteContext) {
  await ensureSeeded()
  if (!getFromStore(params.id)) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateTranscriptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 })
  }

  const updated = updateInStore(params.id, { transcript: parsed.data.transcript })
  return NextResponse.json(updated, { status: 200 })
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  await ensureSeeded()
  if (!getFromStore(params.id)) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }
  removeFromStore(params.id)
  return new NextResponse(null, { status: 204 })
}
