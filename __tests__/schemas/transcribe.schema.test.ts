import {
  transcribeRequestSchema,
  transcribeResponseSchema,
} from '@/lib/schemas/transcribe.schema'

function makeAudio(): File {
  return new File([new Blob(['hello'])], 'recording.webm', {
    type: 'audio/webm',
  })
}

describe('transcribeRequestSchema', () => {
  it('accepts a valid meetingId + File pair', () => {
    const result = transcribeRequestSchema.safeParse({
      meetingId: 'mtg_1',
      audio: makeAudio(),
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty meetingId', () => {
    const result = transcribeRequestSchema.safeParse({
      meetingId: '',
      audio: makeAudio(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing audio', () => {
    const result = transcribeRequestSchema.safeParse({
      meetingId: 'mtg_1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects audio that is not a File', () => {
    const result = transcribeRequestSchema.safeParse({
      meetingId: 'mtg_1',
      audio: 'not a file',
    })
    expect(result.success).toBe(false)
  })
})

describe('transcribeResponseSchema', () => {
  it('accepts a valid transcript + durationSeconds pair', () => {
    expect(
      transcribeResponseSchema.safeParse({
        transcript: 'Alice: hi.',
        durationSeconds: 137,
      }).success,
    ).toBe(true)
  })

  it('rejects an empty transcript', () => {
    expect(
      transcribeResponseSchema.safeParse({
        transcript: '',
        durationSeconds: 1,
      }).success,
    ).toBe(false)
  })

  it('rejects a negative durationSeconds', () => {
    expect(
      transcribeResponseSchema.safeParse({
        transcript: 'ok',
        durationSeconds: -1,
      }).success,
    ).toBe(false)
  })

  it('accepts durationSeconds === 0 as the boundary case', () => {
    expect(
      transcribeResponseSchema.safeParse({
        transcript: 'ok',
        durationSeconds: 0,
      }).success,
    ).toBe(true)
  })
})
