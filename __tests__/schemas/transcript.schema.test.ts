import { updateTranscriptSchema } from '@/lib/schemas/transcript.schema'

describe('updateTranscriptSchema', () => {
  it('accepts a non-empty transcript under 100k chars', () => {
    expect(
      updateTranscriptSchema.safeParse({ transcript: 'Alice: hi.' }).success,
    ).toBe(true)
  })

  it('rejects an empty string with a clear message', () => {
    const result = updateTranscriptSchema.safeParse({ transcript: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Transcript cannot be empty',
      )
    }
  })

  it('rejects a transcript over 100k chars', () => {
    const result = updateTranscriptSchema.safeParse({
      transcript: 'x'.repeat(100_001),
    })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 100k chars (boundary)', () => {
    expect(
      updateTranscriptSchema.safeParse({ transcript: 'x'.repeat(100_000) })
        .success,
    ).toBe(true)
  })
})
