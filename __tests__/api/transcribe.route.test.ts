/**
 * @jest-environment node
 *
 * Node 20's built-in `Request`, `FormData`, and `File` are what the Next.js
 * route handler will see in production. The jsdom environment's variants
 * have gaps with multipart parsing, so we opt in to `node` here.
 */

// Mock the OpenAI SDK before importing the route. Jest hoists this above
// any module-level `new OpenAI(...)` in the route handler.
const mockCreate = jest.fn()
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: mockCreate,
      },
    },
  })),
}))

// eslint-disable-next-line import/order
import { POST } from '@/app/api/transcribe/route'

function makeFormReq(
  fields: Record<string, string | File | undefined>,
): Request {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) form.set(k, v as Blob | string)
  }
  return new Request('http://localhost/api/transcribe', {
    method: 'POST',
    body: form,
  })
}

function makeAudioFile(
  size = 1024,
  type = 'audio/webm',
  name = 'recording.webm',
): File {
  return new File([new Uint8Array(size)], name, { type })
}

beforeEach(() => {
  mockCreate.mockReset()
  process.env.OPENAI_API_KEY = 'test-key'
})

describe('POST /api/transcribe', () => {
  it('happy path: returns 200 with the produced transcript + duration and echoes meetingId', async () => {
    mockCreate.mockResolvedValueOnce({
      text: 'Alice: hi there.',
      duration: 137,
    })

    const res = await POST(
      makeFormReq({ meetingId: 'mtg_1', audio: makeAudioFile() }),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Meeting-Id')).toBe('mtg_1')
    const body = await res.json()
    expect(body).toEqual({ transcript: 'Alice: hi there.', durationSeconds: 137 })
  })

  it('400 when meetingId is missing', async () => {
    const res = await POST(makeFormReq({ audio: makeAudioFile() }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing meetingId' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('400 when audio is missing', async () => {
    const res = await POST(makeFormReq({ meetingId: 'mtg_1' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing audio' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('413 when the audio file exceeds 25 MB', async () => {
    const tooBig = makeAudioFile(25 * 1024 * 1024 + 1)
    const res = await POST(
      makeFormReq({ meetingId: 'mtg_1', audio: tooBig }),
    )
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'Audio exceeds maximum size' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('415 when the audio MIME type is unsupported', async () => {
    const res = await POST(
      makeFormReq({
        meetingId: 'mtg_1',
        audio: makeAudioFile(1024, 'application/octet-stream', 'rec.bin'),
      }),
    )
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ error: 'Audio MIME type not supported' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('422 when the SDK returns a whitespace-only transcript', async () => {
    mockCreate.mockResolvedValueOnce({ text: '   ', duration: 3 })
    const res = await POST(
      makeFormReq({ meetingId: 'mtg_1', audio: makeAudioFile() }),
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'No speech detected' })
  })

  it('422 when every segment reports no_speech_prob above the threshold (Whisper hallucinated on silence)', async () => {
    // Whisper notoriously hallucinates short phrases like "Bye." or
    // "Thanks for watching!" on silent audio. The `text` field is
    // non-empty in that case, but every segment's `no_speech_prob` is
    // high. Treat that as no-speech the same way we'd treat an empty
    // transcript.
    mockCreate.mockResolvedValueOnce({
      text: 'Bye.',
      duration: 4,
      segments: [
        {
          id: 0,
          seek: 0,
          start: 0,
          end: 4,
          text: 'Bye.',
          tokens: [],
          temperature: 0,
          avg_logprob: -1.5,
          compression_ratio: 0.4,
          no_speech_prob: 0.95,
        },
      ],
    })
    const res = await POST(
      makeFormReq({ meetingId: 'mtg_1', audio: makeAudioFile() }),
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'No speech detected' })
  })

  it('200 when at least one segment has speech (mixed silence + speech)', async () => {
    mockCreate.mockResolvedValueOnce({
      text: 'Alice: Hi there.',
      duration: 10,
      segments: [
        {
          id: 0,
          start: 0,
          end: 5,
          text: '',
          no_speech_prob: 0.92,
        },
        {
          id: 1,
          start: 5,
          end: 10,
          text: 'Alice: Hi there.',
          no_speech_prob: 0.05,
        },
      ],
    })
    const res = await POST(
      makeFormReq({ meetingId: 'mtg_1', audio: makeAudioFile() }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.transcript).toBe('Alice: Hi there.')
  })

  it('500 when the SDK call rejects (provider failure)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('upstream 500'))
    const res = await POST(
      makeFormReq({ meetingId: 'mtg_1', audio: makeAudioFile() }),
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Transcription failed' })
  })
})
