/**
 * @jest-environment node
 *
 * jsdom 20's `FormData` and `File` have subtle gaps; Node 20 has full,
 * cleanly typed implementations of both. The fetcher itself is environment-
 * agnostic — its tests just need a runtime where the platform types behave.
 */
import {
  MAX_AUDIO_BYTES,
  transcribeAudio,
  type TranscriptionError,
} from '@/lib/fetchers/transcribe.fetcher'

function makeAudio(size: number, type = 'audio/webm'): File {
  // Build a Blob of the requested size, then wrap it in a File so the
  // fetcher sees the same shape the browser would hand it.
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], 'recording.webm', { type })
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

beforeEach(() => {
  ;(global.fetch as jest.Mock) = jest.fn()
})

describe('MAX_AUDIO_BYTES', () => {
  it('is exactly 25 MiB (the provider hard cap)', () => {
    expect(MAX_AUDIO_BYTES).toBe(25 * 1024 * 1024)
  })
})

describe('transcribeAudio — happy path', () => {
  it('POSTs /api/transcribe with multipart form data carrying meetingId and audio', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ transcript: 'hello', durationSeconds: 5 }),
    )

    await transcribeAudio({
      meetingId: 'mtg_1',
      audio: makeAudio(1024),
    })

    const [calledUrl, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(calledUrl).toBe('/api/transcribe')
    expect(init.method).toBe('POST')
    // Browser must set the multipart boundary; the fetcher must NOT set
    // Content-Type itself, or the boundary will be missing and the request
    // will arrive at the server unparseable.
    expect((init.headers as Record<string, string>) ?? {}).not.toHaveProperty(
      'Content-Type',
    )
    expect(init.body).toBeInstanceOf(FormData)
    const form = init.body as FormData
    expect(form.get('meetingId')).toBe('mtg_1')
    const audio = form.get('audio')
    expect(audio).toBeInstanceOf(File)
  })

  it('resolves with the parsed response body on 200', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ transcript: 'Alice: hi.', durationSeconds: 12 }),
    )
    const out = await transcribeAudio({
      meetingId: 'mtg_1',
      audio: makeAudio(1024),
    })
    expect(out).toEqual({ transcript: 'Alice: hi.', durationSeconds: 12 })
  })
})

describe('transcribeAudio — pre-flight size cap', () => {
  it('rejects with TOO_LARGE without making a network call when audio.size > MAX_AUDIO_BYTES', async () => {
    const tooBig = makeAudio(MAX_AUDIO_BYTES + 1)

    let caught: TranscriptionError | null = null
    try {
      await transcribeAudio({ meetingId: 'mtg_1', audio: tooBig })
    } catch (err) {
      caught = err as TranscriptionError
    }

    expect(caught?.kind).toBe('TOO_LARGE')
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(0)
  })

  it('accepts audio at exactly MAX_AUDIO_BYTES (boundary)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ transcript: 'ok', durationSeconds: 1 }),
    )
    await transcribeAudio({
      meetingId: 'mtg_1',
      audio: makeAudio(MAX_AUDIO_BYTES),
    })
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1)
  })
})

describe('transcribeAudio — HTTP status → TranscriptionError.kind mapping', () => {
  async function expectKind(status: number, expected: TranscriptionError['kind']) {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ error: 'message' }, { status }),
    )
    let caught: TranscriptionError | null = null
    try {
      await transcribeAudio({ meetingId: 'mtg_1', audio: makeAudio(1024) })
    } catch (err) {
      caught = err as TranscriptionError
    }
    expect(caught?.kind).toBe(expected)
  }

  it('maps 413 → TOO_LARGE', () => expectKind(413, 'TOO_LARGE'))
  it('maps 422 → NO_SPEECH', () => expectKind(422, 'NO_SPEECH'))
  it('maps 415 → PROVIDER', () => expectKind(415, 'PROVIDER'))
  it('maps 400 → PROVIDER', () => expectKind(400, 'PROVIDER'))
  it('maps 500 → PROVIDER', () => expectKind(500, 'PROVIDER'))
})

describe('transcribeAudio — transport-level failures', () => {
  it('maps fetch throw → NETWORK', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('socket reset'))
    let caught: TranscriptionError | null = null
    try {
      await transcribeAudio({ meetingId: 'mtg_1', audio: makeAudio(1024) })
    } catch (err) {
      caught = err as TranscriptionError
    }
    expect(caught?.kind).toBe('NETWORK')
  })

  it('maps a 200 with a body that fails response-schema validation → PROVIDER', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ transcript: '', durationSeconds: -1 }),
    )
    let caught: TranscriptionError | null = null
    try {
      await transcribeAudio({ meetingId: 'mtg_1', audio: makeAudio(1024) })
    } catch (err) {
      caught = err as TranscriptionError
    }
    expect(caught?.kind).toBe('PROVIDER')
  })
})
