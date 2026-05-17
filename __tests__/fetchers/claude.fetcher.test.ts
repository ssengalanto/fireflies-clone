/**
 * @jest-environment node
 *
 * jsdom 20 doesn't expose `Response`/`ReadableStream` as globals. Node 20
 * does (via undici), so this fetcher's stream-handling tests run cleanly
 * under the `node` environment.
 */
import { fetchSummary } from '@/lib/fetchers/claude.fetcher'

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
