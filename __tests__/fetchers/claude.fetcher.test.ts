/**
 * @jest-environment node
 *
 * jsdom 20 doesn't expose `Response`/`ReadableStream` as globals. Node 20
 * does (via undici), so this fetcher's stream-handling tests run cleanly
 * under the `node` environment.
 */
import {
  fetchActionItems,
  fetchSummary,
  parseActionItems,
} from '@/lib/fetchers/claude.fetcher'

function makeStreamResponse(
  chunks: string[],
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...init.headers,
    },
  })
}

function jsonErrorResponse(error: string, status = 400): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  ;(global.fetch as jest.Mock) = jest.fn()
})

describe('fetchSummary', () => {
  it('POSTs /api/claude with type="summary", meetingId, and transcript', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(makeStreamResponse([]))

    await fetchSummary({ meetingId: 'mtg_1', transcript: 'x'.repeat(60) })

    const [calledUrl, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(calledUrl).toBe('/api/claude')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'summary',
      meetingId: 'mtg_1',
      transcript: 'x'.repeat(60),
    })
  })

  it('resolves with the concatenated string from streamed chunks', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      makeStreamResponse(['Hello ', 'streamed ', 'world.']),
    )

    const final = await fetchSummary({
      meetingId: 'mtg_1',
      transcript: 'x'.repeat(60),
    })
    expect(final).toBe('Hello streamed world.')
  })

  it('invokes onChunk for each decoded chunk in order', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      makeStreamResponse(['Hello ', 'world.']),
    )
    const chunks: string[] = []

    const final = await fetchSummary(
      { meetingId: 'mtg_1', transcript: 'x'.repeat(60) },
      (c) => chunks.push(c),
    )

    expect(chunks).toEqual(['Hello ', 'world.'])
    expect(final).toBe('Hello world.')
  })

  it('throws with the server error message on !res.ok', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      jsonErrorResponse('Transcript too short', 400),
    )

    await expect(
      fetchSummary({ meetingId: 'mtg_1', transcript: 'x'.repeat(60) }),
    ).rejects.toThrow('Transcript too short')
  })

  it('throws when the response body is missing', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    await expect(
      fetchSummary({ meetingId: 'mtg_1', transcript: 'x'.repeat(60) }),
    ).rejects.toThrow(/body/i)
  })
})

describe('parseActionItems', () => {
  const valid = {
    id: 'ai_1',
    text: 'Follow up with Bob',
    owner: 'alice@example.com',
    dueDate: '2026-05-22T00:00:00.000Z',
  }

  it('parses a plain JSON array of valid items', () => {
    expect(parseActionItems(JSON.stringify([valid]))).toEqual([valid])
  })

  it('strips ```json fences before parsing', () => {
    const fenced = '```json\n' + JSON.stringify([valid]) + '\n```'
    expect(parseActionItems(fenced)).toEqual([valid])
  })

  it('strips bare ``` fences before parsing', () => {
    const fenced = '```\n' + JSON.stringify([valid]) + '\n```'
    expect(parseActionItems(fenced)).toEqual([valid])
  })

  it('defaults to [] on totally unparseable input', () => {
    expect(parseActionItems('not json at all, just words')).toEqual([])
  })

  it('defaults to [] when the parsed value is not an array', () => {
    expect(parseActionItems(JSON.stringify({ items: [] }))).toEqual([])
  })

  it('drops items that fail actionItemSchema validation', () => {
    const result = parseActionItems(
      JSON.stringify([
        valid,
        { text: '', owner: null, dueDate: null }, // empty text → invalid
        'not an object',
        { text: 'no id field', owner: null, dueDate: null }, // missing id → synthesized
      ]),
    )
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].text).toBe('Follow up with Bob')
    // Items missing `id` get a synthesized one starting with `ai_`.
    const synthesized = result.find((r) => r.text === 'no id field')
    expect(synthesized?.id).toMatch(/^ai_/)
  })

  it('returns an empty array for an empty JSON array', () => {
    expect(parseActionItems('[]')).toEqual([])
  })
})

describe('fetchActionItems', () => {
  it('POSTs /api/claude with type="action-items" and returns the parsed array', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'ai_1',
            text: 'Send the deck',
            owner: null,
            dueDate: null,
          },
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const result = await fetchActionItems({
      meetingId: 'mtg_1',
      transcript: 'x'.repeat(60),
    })

    const [calledUrl, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(calledUrl).toBe('/api/claude')
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      type: 'action-items',
      meetingId: 'mtg_1',
      transcript: 'x'.repeat(60),
    })
    expect(result).toEqual([
      { id: 'ai_1', text: 'Send the deck', owner: null, dueDate: null },
    ])
  })

  it('returns [] when the server response is an empty array', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const result = await fetchActionItems({
      meetingId: 'mtg_1',
      transcript: 'x'.repeat(60),
    })
    expect(result).toEqual([])
  })

  it('re-validates each item — invalid items are dropped client-side too', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: 'ai_1', text: 'Valid', owner: null, dueDate: null },
          { id: 'ai_2', text: '', owner: null, dueDate: null }, // invalid
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    const result = await fetchActionItems({
      meetingId: 'mtg_1',
      transcript: 'x'.repeat(60),
    })
    expect(result).toEqual([
      { id: 'ai_1', text: 'Valid', owner: null, dueDate: null },
    ])
  })

  it('throws with the server error on !res.ok', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Transcript too short' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(
      fetchActionItems({ meetingId: 'mtg_1', transcript: 'x'.repeat(60) }),
    ).rejects.toThrow('Transcript too short')
  })
})
