import {
  __resetMeetingStoreForTests,
  create,
  get,
  list,
  remove,
  seedFromFile,
  update,
} from '@/lib/server/meetingStore'

const validInput = {
  title: 'Standup',
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
}

beforeEach(() => {
  __resetMeetingStoreForTests()
})

describe('lib/server/meetingStore', () => {
  describe('seedFromFile', () => {
    it('populates the store and is idempotent', async () => {
      await seedFromFile()
      const first = list({})
      await seedFromFile() // second call must not duplicate
      const second = list({})

      expect(second.items.length).toBe(first.items.length)
      expect(second.items.length).toBeGreaterThan(0)
    })
  })

  describe('create', () => {
    it('returns a record with an mtg_ prefixed id and equal createdAt/updatedAt', () => {
      const created = create(validInput)

      expect(created.id).toMatch(/^mtg_/)
      expect(created.createdAt).toBeTruthy()
      expect(created.updatedAt).toBe(created.createdAt)
      expect(created.status).toBe('draft')
      expect(created.transcript).toBeNull()
      expect(created.durationSeconds).toBe(0)
      expect(created.title).toBe(validInput.title)
      expect(created.participants).toEqual(validInput.participants)
    })
  })

  describe('get', () => {
    it('returns the stored record', () => {
      const created = create(validInput)
      expect(get(created.id)).toEqual(created)
    })

    it('returns undefined for an unknown id', () => {
      expect(get('mtg_unknown')).toBeUndefined()
    })
  })

  describe('update', () => {
    it('bumps updatedAt and recomputes status when transcript is set', async () => {
      const created = create(validInput)
      // Force the clock forward so updatedAt > createdAt is detectable.
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = update(created.id, { transcript: 'Alice: hello.' })

      expect(updated.transcript).toBe('Alice: hello.')
      expect(updated.status).toBe('recorded')
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(created.updatedAt).getTime(),
      )
    })

    it('throws on an unknown id', () => {
      expect(() => update('mtg_unknown', { transcript: 'x' })).toThrow()
    })
  })

  describe('remove', () => {
    it('makes a subsequent get return undefined', () => {
      const created = create(validInput)
      remove(created.id)
      expect(get(created.id)).toBeUndefined()
    })

    it('throws on an unknown id', () => {
      expect(() => remove('mtg_unknown')).toThrow()
    })
  })

  describe('list', () => {
    beforeEach(() => {
      const base = Date.now()
      create({
        ...validInput,
        title: 'Standup',
        date: new Date(base - 1000).toISOString(),
      })
      create({
        ...validInput,
        title: 'Roadmap review',
        participants: ['bob@example.com'],
        date: new Date(base - 2000).toISOString(),
      })
      create({
        ...validInput,
        title: 'Standup retro',
        date: new Date(base - 3000).toISOString(),
      })
    })

    it('returns items sorted by createdAt DESC', () => {
      const { items } = list({})
      const timestamps = items.map((m) => new Date(m.createdAt).getTime())
      const sorted = [...timestamps].sort((a, b) => b - a)
      expect(timestamps).toEqual(sorted)
    })

    it('filters by search across title and participants, case-insensitive', () => {
      const titleMatch = list({ search: 'standup' })
      expect(titleMatch.items).toHaveLength(2)
      expect(titleMatch.items.every((m) => /standup/i.test(m.title))).toBe(true)

      const participantMatch = list({ search: 'BOB@' })
      expect(participantMatch.items).toHaveLength(1)
      expect(participantMatch.items[0].participants).toContain('bob@example.com')
    })

    it('filters by status', () => {
      const { items } = list({ status: 'draft' })
      expect(items.every((m) => m.status === 'draft')).toBe(true)
    })

    it('treats status="all" as no status filter', () => {
      const { items } = list({ status: 'all' })
      expect(items).toHaveLength(3)
    })

    it('paginates by opaque cursor with no overlap and no gap', () => {
      const page1 = list({ limit: 2 })
      expect(page1.items).toHaveLength(2)
      expect(page1.nextCursor).toBeTruthy()

      const page2 = list({ limit: 2, cursor: page1.nextCursor! })
      expect(page2.items).toHaveLength(1)
      expect(page2.nextCursor).toBeNull()

      const allIds = [
        ...page1.items.map((m) => m.id),
        ...page2.items.map((m) => m.id),
      ]
      expect(new Set(allIds).size).toBe(3)
    })

    it('cursor pagination walks the FILTERED set, not the unfiltered one', () => {
      // Among the three seeded meetings, two match "standup" (the original
      // Standup and Standup retro). The non-matching "Roadmap review" must
      // not appear in any paginated page when the filter is active.
      const page1 = list({ search: 'standup', limit: 1 })
      expect(page1.items).toHaveLength(1)
      expect(/standup/i.test(page1.items[0].title)).toBe(true)
      expect(page1.nextCursor).toBeTruthy()

      const page2 = list({
        search: 'standup',
        limit: 1,
        cursor: page1.nextCursor!,
      })
      expect(page2.items).toHaveLength(1)
      expect(/standup/i.test(page2.items[0].title)).toBe(true)
      expect(page2.nextCursor).toBeNull()

      // The unfiltered "Roadmap review" record was not reachable via the
      // filtered cursor at any point.
      const filteredIds = [
        ...page1.items.map((m) => m.id),
        ...page2.items.map((m) => m.id),
      ]
      expect(filteredIds).toHaveLength(2)
      expect(new Set(filteredIds).size).toBe(2)
    })
  })
})
