import OpenAI from 'openai'
import { NextResponse } from 'next/server'

// This is the ONLY file in the repo allowed to import `openai` or to touch
// `OPENAI_API_KEY`. The variable is read directly from `process.env` (no
// proxy module) so Next.js's compile-time inlining of `NEXT_PUBLIC_*` can
// never accidentally bake it into the client bundle. The static security
// test in `__tests__/security/api-key-isolation.test.ts` enforces both
// invariants on every CI run.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MODEL = 'whisper-1'
const MAX_AUDIO_BYTES = 25 * 1024 * 1024

export const SUPPORTED_AUDIO_MIME = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/m4a',
  'audio/mp3',
  // Some browsers attach codec parameters (e.g. "audio/webm;codecs=opus").
  // We match the prefix in code, not in this list — see `mimeIsSupported`.
] as const

function mimeIsSupported(type: string): boolean {
  const base = type.split(';')[0].trim().toLowerCase()
  return (SUPPORTED_AUDIO_MIME as readonly string[]).includes(base)
}

export async function POST(req: Request): Promise<Response> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const meetingId = form.get('meetingId')
  if (typeof meetingId !== 'string' || meetingId.length === 0) {
    return NextResponse.json({ error: 'Missing meetingId' }, { status: 400 })
  }

  const audio = form.get('audio')
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'Missing audio' }, { status: 400 })
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: 'Audio exceeds maximum size' },
      { status: 413 },
    )
  }

  if (!mimeIsSupported(audio.type)) {
    return NextResponse.json(
      { error: 'Audio MIME type not supported' },
      { status: 415 },
    )
  }

  let result: { text?: unknown; duration?: unknown }
  try {
    result = (await client.audio.transcriptions.create({
      file: audio,
      model: MODEL,
      response_format: 'verbose_json',
    })) as { text?: unknown; duration?: unknown }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[transcribe.route] SDK error:', err)
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 },
    )
  }

  const transcript =
    typeof result.text === 'string' ? result.text.trim() : ''
  if (transcript.length === 0) {
    return NextResponse.json(
      { error: 'No speech detected' },
      { status: 422 },
    )
  }

  const durationSeconds =
    typeof result.duration === 'number' && result.duration >= 0
      ? result.duration
      : 0

  return new Response(
    JSON.stringify({ transcript, durationSeconds }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Meeting-Id': meetingId,
      },
    },
  )
}
