import {
  transcribeResponseSchema,
  type TranscribeResponse,
} from '@/lib/schemas/transcribe.schema'

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024

export type TranscriptionError =
  | { kind: 'NETWORK'; message: string }
  | { kind: 'TOO_LARGE'; message: string }
  | { kind: 'NO_SPEECH'; message: string }
  | { kind: 'PROVIDER'; message: string }

export interface TranscribeAudioInput {
  meetingId: string
  audio: Blob
}

function err(
  kind: TranscriptionError['kind'],
  message: string,
): TranscriptionError {
  return { kind, message }
}

function statusToErr(status: number): TranscriptionError {
  if (status === 413) return err('TOO_LARGE', 'Audio exceeds maximum size')
  if (status === 422) return err('NO_SPEECH', 'No speech detected')
  return err('PROVIDER', `Transcription failed (${status})`)
}

/**
 * Uploads the recorded audio Blob to `/api/transcribe` as multipart form
 * data and returns the produced transcript. Rejects with a typed
 * `TranscriptionError` describing the failure mode so the UI can branch on
 * `kind` instead of parsing strings.
 *
 * Pre-flight: rejects with `TOO_LARGE` synchronously if the audio exceeds
 * 25 MB. The server enforces the same cap as defense-in-depth (HTTP 413).
 */
export async function transcribeAudio(
  input: TranscribeAudioInput,
): Promise<TranscribeResponse> {
  if (input.audio.size > MAX_AUDIO_BYTES) {
    throw err('TOO_LARGE', 'Recording is too long. Maximum size is 25 MB.')
  }

  const form = new FormData()
  form.set('meetingId', input.meetingId)
  form.set(
    'audio',
    input.audio instanceof File
      ? input.audio
      : new File([input.audio], 'recording.webm', { type: input.audio.type }),
  )

  let res: Response
  try {
    res = await fetch('/api/transcribe', { method: 'POST', body: form })
  } catch (e) {
    throw err('NETWORK', e instanceof Error ? e.message : String(e))
  }

  if (!res.ok) {
    throw statusToErr(res.status)
  }

  let body: unknown
  try {
    body = await res.json()
  } catch (e) {
    throw err(
      'PROVIDER',
      `Malformed response body: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const parsed = transcribeResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw err('PROVIDER', 'Response did not match the expected shape')
  }
  return parsed.data
}
