/**
 * @jest-environment node
 */
import { DELETE, GET, PATCH } from '@/app/api/meetings/[id]/route'
import { create as serverCreate, __resetMeetingStoreForTests } from '@/lib/server/meetingStore'

beforeEach(() => {
  __resetMeetingStoreForTests()
})

function jsonReq(method: string, body?: unknown): Request {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return new Request('http://localhost/api/meetings/test', init)
}

function seedOne() {
  return serverCreate({
    title: 'Standup',
    participants: ['alice@example.com'],
    date: '2026-05-17T10:00:00.000Z',
  })
}

describe('GET /api/meetings/[id]', () => {
  it('returns 200 with the meeting when found', async () => {
    const meeting = seedOne()
    const res = await GET(jsonReq('GET'), { params: { id: meeting.id } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(meeting.id)
  })

  it('returns 404 when not found', async () => {
    const res = await GET(jsonReq('GET'), { params: { id: 'mtg_x' } })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Meeting not found')
  })
})

describe('PATCH /api/meetings/[id]', () => {
  it('updates the transcript and bumps status to recorded', async () => {
    const meeting = seedOne()
    const res = await PATCH(jsonReq('PATCH', { transcript: 'Alice: hi.' }), {
      params: { id: meeting.id },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.transcript).toBe('Alice: hi.')
    expect(body.status).toBe('recorded')
  })

  it('returns 400 on empty transcript', async () => {
    const meeting = seedOne()
    const res = await PATCH(jsonReq('PATCH', { transcript: '' }), {
      params: { id: meeting.id },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Transcript cannot be empty')
  })

  it('returns 404 when id is unknown', async () => {
    const res = await PATCH(jsonReq('PATCH', { transcript: 'hi' }), {
      params: { id: 'mtg_x' },
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/meetings/[id]', () => {
  it('returns 204 and removes the meeting', async () => {
    const meeting = seedOne()
    const res = await DELETE(jsonReq('DELETE'), { params: { id: meeting.id } })
    expect(res.status).toBe(204)

    const getRes = await GET(jsonReq('GET'), { params: { id: meeting.id } })
    expect(getRes.status).toBe(404)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await DELETE(jsonReq('DELETE'), { params: { id: 'mtg_x' } })
    expect(res.status).toBe(404)
  })
})
