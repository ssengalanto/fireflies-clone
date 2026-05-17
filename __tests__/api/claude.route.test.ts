/**
 * @jest-environment node
 */

// Mock @anthropic-ai/sdk before importing the route. Jest hoists the
// jest.mock factory so it runs before any module-level `new Anthropic(...)`.
const mockStreamFn = jest.fn()
const mockCreateFn = jest.fn()
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { stream: mockStreamFn, create: mockCreateFn },
    })),
  }
})

// eslint-disable-next-line import/order
import { POST } from '@/app/api/claude/route'

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeSdkStream(deltas: string[]): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of deltas) {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text },
        }
      }
    },
  }
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder('utf-8')
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  out += decoder.decode()
  return out
}

beforeEach(() => {
  mockStreamFn.mockReset()
  mockCreateFn.mockReset()
})

function messageWith(text: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-opus-4-7',
    stop_reason: 'end_turn',
  }
}

const validBody = {
  type: 'summary' as const,
  meetingId: 'mtg_42',
  transcript: 'a'.repeat(60),
}

describe('POST /api/claude — summary', () => {
  it('echoes X-Meeting-Id, streams text/plain, and concatenates deltas', async () => {
    mockStreamFn.mockReturnValue(makeSdkStream(['Hello ', 'world.']))

    const res = await POST(jsonReq(validBody))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/plain/)
    expect(res.headers.get('X-Meeting-Id')).toBe('mtg_42')

    const body = await readStream(res)
    expect(body).toBe('Hello world.')
  })

  it('ignores non-text-delta events', async () => {
    mockStreamFn.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { type: 'message_start' }
        yield { type: 'content_block_start' }
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'A ' },
        }
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'B.' },
        }
        yield { type: 'message_stop' }
      },
    } as AsyncIterable<unknown>)

    const res = await POST(jsonReq(validBody))
    const body = await readStream(res)
    expect(body).toBe('A B.')
  })

  it('returns 400 when the transcript is too short', async () => {
    const res = await POST(jsonReq({ ...validBody, transcript: 'too short' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Transcript too short')
    expect(mockStreamFn).not.toHaveBeenCalled()
  })

  it('returns 400 when type is missing or invalid', async () => {
    const res = await POST(jsonReq({ ...validBody, type: 'bogus' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when the SDK throws synchronously', async () => {
    mockStreamFn.mockImplementation(() => {
      throw new Error('upstream auth failure')
    })

    const res = await POST(jsonReq(validBody))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to generate summary')
  })

  it('returns 400 on a malformed JSON body', async () => {
    const malformed = new Request('http://localhost/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    const res = await POST(malformed)
    expect(res.status).toBe(400)
  })
})

const validActionItemsBody = {
  type: 'action-items' as const,
  meetingId: 'mtg_42',
  transcript: 'a'.repeat(60),
}

describe('POST /api/claude — action items', () => {
  it('returns parsed ActionItem[] as JSON', async () => {
    mockCreateFn.mockResolvedValue(
      messageWith(
        JSON.stringify([
          { text: 'Send the deck', owner: null, dueDate: null },
          { text: 'Follow up with Bob', owner: 'alice@example.com', dueDate: null },
        ]),
      ),
    )

    const res = await POST(jsonReq(validActionItemsBody))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0].id).toMatch(/^ai_/)
    expect(body[0].text).toBe('Send the deck')
    expect(body[1].owner).toBe('alice@example.com')
  })

  it('strips markdown fences before parsing', async () => {
    mockCreateFn.mockResolvedValue(
      messageWith(
        '```json\n[{"text":"do x","owner":null,"dueDate":null}]\n```',
      ),
    )

    const res = await POST(jsonReq(validActionItemsBody))
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].text).toBe('do x')
  })

  it('returns [] with X-Parse-Fallback header when the model output is unparseable', async () => {
    mockCreateFn.mockResolvedValue(
      messageWith('totally not JSON, just words from the model'),
    )

    const res = await POST(jsonReq(validActionItemsBody))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Parse-Fallback')).toBe('empty-list')
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns [] WITHOUT X-Parse-Fallback when the model legitimately returns an empty array', async () => {
    mockCreateFn.mockResolvedValue(messageWith('[]'))
    const res = await POST(jsonReq(validActionItemsBody))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Parse-Fallback')).toBeNull()
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 400 when the transcript is too short', async () => {
    const res = await POST(
      jsonReq({ ...validActionItemsBody, transcript: 'short' }),
    )
    expect(res.status).toBe(400)
    expect(mockCreateFn).not.toHaveBeenCalled()
  })

  it('returns 500 when the SDK rejects', async () => {
    mockCreateFn.mockRejectedValue(new Error('upstream auth failure'))
    const res = await POST(jsonReq(validActionItemsBody))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to extract action items')
  })
})
