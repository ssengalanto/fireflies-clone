import {
  actionItemSchema,
  createMeetingSchema,
  meetingSchema,
} from '@/lib/schemas/meeting.schema'

const validCreateInput = {
  title: 'Standup',
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
}

const validMeeting = {
  ...validCreateInput,
  id: 'mtg_1',
  durationSeconds: 0,
  status: 'draft' as const,
  transcript: null,
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
}

describe('createMeetingSchema', () => {
  it('accepts a valid input', () => {
    expect(createMeetingSchema.safeParse(validCreateInput).success).toBe(true)
  })

  it('rejects an empty title with a clear message', () => {
    const result = createMeetingSchema.safeParse({
      ...validCreateInput,
      title: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Title is required')
    }
  })

  it('rejects a title over 120 chars', () => {
    const result = createMeetingSchema.safeParse({
      ...validCreateInput,
      title: 'x'.repeat(121),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Title is too long')
    }
  })

  it('rejects an empty participants array', () => {
    const result = createMeetingSchema.safeParse({
      ...validCreateInput,
      participants: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'At least one participant is required',
      )
    }
  })

  it('rejects a malformed participant email', () => {
    const result = createMeetingSchema.safeParse({
      ...validCreateInput,
      participants: ['not-an-email'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid participant email')
    }
  })

  it('rejects a non-ISO date', () => {
    const result = createMeetingSchema.safeParse({
      ...validCreateInput,
      date: 'tomorrow',
    })
    expect(result.success).toBe(false)
  })
})

describe('meetingSchema', () => {
  it('accepts a fully formed meeting', () => {
    expect(meetingSchema.safeParse(validMeeting).success).toBe(true)
  })

  it('accepts a transcript string when status is recorded', () => {
    expect(
      meetingSchema.safeParse({
        ...validMeeting,
        status: 'recorded',
        transcript: 'Alice: hi.',
      }).success,
    ).toBe(true)
  })

  it('rejects an unknown status value', () => {
    expect(
      meetingSchema.safeParse({ ...validMeeting, status: 'bogus' }).success,
    ).toBe(false)
  })

  it('rejects a negative duration', () => {
    expect(
      meetingSchema.safeParse({ ...validMeeting, durationSeconds: -1 }).success,
    ).toBe(false)
  })
})

describe('actionItemSchema', () => {
  it('accepts a fully populated item', () => {
    const result = actionItemSchema.safeParse({
      id: 'ai_1',
      text: 'Follow up with Bob',
      owner: 'alice@example.com',
      dueDate: '2026-05-22T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an item with null owner and dueDate', () => {
    const result = actionItemSchema.safeParse({
      id: 'ai_2',
      text: 'Send the deck',
      owner: null,
      dueDate: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty text', () => {
    expect(
      actionItemSchema.safeParse({
        id: 'ai_3',
        text: '',
        owner: null,
        dueDate: null,
      }).success,
    ).toBe(false)
  })
})
