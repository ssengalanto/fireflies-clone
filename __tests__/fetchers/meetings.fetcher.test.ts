import {
  createMeeting,
  fetchMeeting,
  fetchMeetingsPage,
  updateTranscript,
} from '@/lib/fetchers/meetings.fetcher'

const meeting = {
  id: 'mtg_1',
  title: 'Standup',
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
  durationSeconds: 0,
  status: 'draft',
  transcript: null,
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
}

function mockJson<T>(body: T, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response)
}

beforeEach(() => {
  ;(global.fetch as jest.Mock) = jest.fn()
})

describe('fetchMeetingsPage', () => {
  it('GETs /api/meetings with no params when none are supplied', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ items: [meeting], nextCursor: null }),
    )

    const result = await fetchMeetingsPage({})

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/meetings',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual({ items: [meeting], nextCursor: null })
  })

  it('builds the query string from filters and cursor and limit', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ items: [], nextCursor: null }),
    )

    await fetchMeetingsPage({
      search: 'standup',
      status: 'recorded',
      cursor: 'cur_1',
      limit: 5,
    })

    const [calledUrl] = (global.fetch as jest.Mock).mock.calls[0] as [string]
    expect(calledUrl).toContain('search=standup')
    expect(calledUrl).toContain('status=recorded')
    expect(calledUrl).toContain('cursor=cur_1')
    expect(calledUrl).toContain('limit=5')
  })

  it('skips empty/all/undefined query params', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ items: [], nextCursor: null }),
    )

    await fetchMeetingsPage({ search: '', status: 'all' })

    const [calledUrl] = (global.fetch as jest.Mock).mock.calls[0] as [string]
    expect(calledUrl).toBe('/api/meetings')
  })

  it('throws with the server error message on !res.ok', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ error: 'Bad request' }, false, 400),
    )

    await expect(fetchMeetingsPage({})).rejects.toThrow('Bad request')
  })
})

describe('fetchMeeting', () => {
  it('GETs /api/meetings/:id and returns the parsed body', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(mockJson(meeting))

    const result = await fetchMeeting('mtg_1')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/meetings/mtg_1',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(meeting)
  })

  it('throws "Meeting not found" on 404', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ error: 'Meeting not found' }, false, 404),
    )
    await expect(fetchMeeting('mtg_x')).rejects.toThrow('Meeting not found')
  })
})

describe('createMeeting', () => {
  it('POSTs JSON body and returns the canonical record', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(mockJson(meeting))

    const result = await createMeeting({
      title: 'Standup',
      participants: ['alice@example.com'],
      date: '2026-05-17T10:00:00.000Z',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/meetings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    )
    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(JSON.parse(callArgs.body as string)).toEqual({
      title: 'Standup',
      participants: ['alice@example.com'],
      date: '2026-05-17T10:00:00.000Z',
    })
    expect(result).toEqual(meeting)
  })

  it('throws the server error on validation failure', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ error: 'Title is required' }, false, 400),
    )

    await expect(
      createMeeting({
        title: '',
        participants: ['alice@example.com'],
        date: '2026-05-17T10:00:00.000Z',
      }),
    ).rejects.toThrow('Title is required')
  })
})

describe('updateTranscript', () => {
  it('PATCHes /api/meetings/:id with the transcript body', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ ...meeting, transcript: 'Alice: hi.', status: 'recorded' }),
    )

    const result = await updateTranscript('mtg_1', 'Alice: hi.')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/meetings/mtg_1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(result.transcript).toBe('Alice: hi.')
    expect(result.status).toBe('recorded')
  })

  it('throws on !res.ok', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      mockJson({ error: 'Transcript cannot be empty' }, false, 400),
    )
    await expect(updateTranscript('mtg_1', '')).rejects.toThrow(
      'Transcript cannot be empty',
    )
  })
})
