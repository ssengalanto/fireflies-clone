import { meetingKeys, type MeetingFilters } from '@/lib/api/cacheKeys'

const filters: MeetingFilters = { search: 'standup', status: 'recorded' }

describe('meetingKeys', () => {
  it('exposes a root tuple at .all', () => {
    expect(meetingKeys.all).toEqual(['meeting'])
  })

  it('lists() nests under .all', () => {
    expect(meetingKeys.lists()).toEqual(['meeting', 'list'])
  })

  it('list(filters) bakes the filters object into the key', () => {
    expect(meetingKeys.list(filters)).toEqual(['meeting', 'list', filters])
  })

  it('detail(id) nests under .all', () => {
    expect(meetingKeys.detail('mtg_1')).toEqual(['meeting', 'detail', 'mtg_1'])
  })

  it('summary(id) nests under detail(id)', () => {
    expect(meetingKeys.summary('mtg_1')).toEqual([
      'meeting',
      'detail',
      'mtg_1',
      'summary',
    ])
  })

  it('actionItems(id) nests under detail(id)', () => {
    expect(meetingKeys.actionItems('mtg_1')).toEqual([
      'meeting',
      'detail',
      'mtg_1',
      'action-items',
    ])
  })

  it('transcribe(id) nests under detail(id)', () => {
    expect(meetingKeys.transcribe('mtg_1')).toEqual([
      'meeting',
      'detail',
      'mtg_1',
      'transcribe',
    ])
  })

  it('produces stable JSON across repeated calls with equivalent inputs', () => {
    const a = meetingKeys.list({ search: 'x', status: 'all' })
    const b = meetingKeys.list({ search: 'x', status: 'all' })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('detail(id) is a prefix of summary(id), actionItems(id), and transcribe(id)', () => {
    const id = 'mtg_42'
    expect(meetingKeys.summary(id).slice(0, 3)).toEqual(meetingKeys.detail(id))
    expect(meetingKeys.actionItems(id).slice(0, 3)).toEqual(meetingKeys.detail(id))
    expect(meetingKeys.transcribe(id).slice(0, 3)).toEqual(meetingKeys.detail(id))
  })
})
