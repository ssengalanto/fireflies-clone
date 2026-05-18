/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/meetings/route'
import { __resetMeetingStoreForTests } from '@/lib/server/meetingStore'

beforeEach(() => {
  __resetMeetingStoreForTests()
})

function jsonReq(method: string, urlPath: string, body?: unknown): Request {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return new Request(`http://localhost${urlPath}`, init)
}

describe('GET /api/meetings', () => {
  it('returns an empty page when the store is empty', async () => {
    const res = await GET(jsonReq('GET', '/api/meetings'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ items: [], nextCursor: null })
  })

  it('returns POSTed meetings in the next GET', async () => {
    const createRes = await POST(
      jsonReq('POST', '/api/meetings', {
        title: 'Standup',
        participants: ['alice@example.com'],
        date: '2030-01-01T10:00:00.000Z',
      }),
    )
    expect(createRes.status).toBe(201)

    const listRes = await GET(jsonReq('GET', '/api/meetings'))
    const body = await listRes.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].title).toBe('Standup')
  })

  it('filters by search query param', async () => {
    await POST(
      jsonReq('POST', '/api/meetings', {
        title: 'Standup',
        participants: ['alice@example.com'],
        date: '2030-01-01T10:00:00.000Z',
      }),
    )
    await POST(
      jsonReq('POST', '/api/meetings', {
        title: 'Roadmap review',
        participants: ['bob@example.com'],
        date: '2030-01-02T10:00:00.000Z',
      }),
    )
    const res = await GET(jsonReq('GET', '/api/meetings?search=roadmap'))
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].title).toBe('Roadmap review')
  })
})

describe('POST /api/meetings', () => {
  it('returns 201 with the canonical record on valid input', async () => {
    const res = await POST(
      jsonReq('POST', '/api/meetings', {
        title: 'Standup',
        participants: ['alice@example.com'],
        date: '2030-01-01T10:00:00.000Z',
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toMatch(/^mtg_/)
    expect(body.title).toBe('Standup')
    expect(body.status).toBe('draft')
    expect(body.transcript).toBeNull()
    expect(body.createdAt).toBeTruthy()
  })

  it('returns 400 when the title is empty', async () => {
    const res = await POST(
      jsonReq('POST', '/api/meetings', {
        title: '',
        participants: ['alice@example.com'],
        date: '2030-01-01T10:00:00.000Z',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Title is required')
  })

  it('returns 400 when participants is empty', async () => {
    const res = await POST(
      jsonReq('POST', '/api/meetings', {
        title: 'Standup',
        participants: [],
        date: '2030-01-01T10:00:00.000Z',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('At least one participant is required')
  })

  it('returns 400 when a participant email is malformed', async () => {
    const res = await POST(
      jsonReq('POST', '/api/meetings', {
        title: 'Standup',
        participants: ['not-an-email'],
        date: '2030-01-01T10:00:00.000Z',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid participant email')
  })
})
