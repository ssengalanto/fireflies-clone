import type { MeetingStatusFilter } from '@/lib/api/cacheKeys'
import type {
  CreateMeetingInput,
  Meeting,
} from '@/lib/schemas/meeting.schema'

export interface MeetingPage {
  items: Meeting[]
  nextCursor: string | null
}

export interface FetchMeetingsPageParams {
  search?: string
  status?: MeetingStatusFilter
  cursor?: string
  limit?: number
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let message = fallback
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // body wasn't JSON; keep the fallback
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export async function fetchMeetingsPage(
  params: FetchMeetingsPageParams,
): Promise<MeetingPage> {
  const qs = new URLSearchParams()
  if (params.search && params.search.length > 0) qs.set('search', params.search)
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))

  const query = qs.toString()
  const url = query ? `/api/meetings?${query}` : '/api/meetings'

  const res = await fetch(url, { method: 'GET' })
  return unwrap<MeetingPage>(res, 'Failed to load meetings')
}

export async function fetchMeeting(id: string): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}`, { method: 'GET' })
  return unwrap<Meeting>(res, 'Failed to load meeting')
}

export async function createMeeting(
  input: CreateMeetingInput,
): Promise<Meeting> {
  const res = await fetch('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return unwrap<Meeting>(res, 'Failed to create meeting')
}

export async function updateTranscript(
  id: string,
  transcript: string,
): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  })
  return unwrap<Meeting>(res, 'Failed to update transcript')
}
