import { claudeRequestSchema } from '@/lib/schemas/claude.schema'

const validSummary = {
  type: 'summary' as const,
  meetingId: 'mtg_1',
  transcript: 'a'.repeat(60),
}

const validActionItems = {
  type: 'action-items' as const,
  meetingId: 'mtg_1',
  transcript: 'a'.repeat(60),
}

describe('claudeRequestSchema', () => {
  it('accepts a valid summary request', () => {
    expect(claudeRequestSchema.safeParse(validSummary).success).toBe(true)
  })

  it('accepts a valid action-items request', () => {
    expect(claudeRequestSchema.safeParse(validActionItems).success).toBe(true)
  })

  it('rejects an unknown type', () => {
    const result = claudeRequestSchema.safeParse({
      ...validSummary,
      type: 'bogus',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty meetingId', () => {
    const result = claudeRequestSchema.safeParse({
      ...validSummary,
      meetingId: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a transcript shorter than 50 characters with a clear message', () => {
    const result = claudeRequestSchema.safeParse({
      ...validSummary,
      transcript: 'too short',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Transcript too short')
    }
  })

  it('accepts exactly 50 characters (boundary)', () => {
    expect(
      claudeRequestSchema.safeParse({
        ...validSummary,
        transcript: 'a'.repeat(50),
      }).success,
    ).toBe(true)
  })
})
