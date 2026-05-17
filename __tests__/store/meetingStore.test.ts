import { act, renderHook } from '@testing-library/react'

import {
  DEFAULT_MEETING_FILTERS,
  useMeetingStore,
} from '@/lib/store/meetingStore'

beforeEach(() => {
  useMeetingStore.setState({
    selectedIds: [],
    filters: { ...DEFAULT_MEETING_FILTERS },
    meetingDraft: null,
    wizardStep: 0,
  })
})

describe('useMeetingStore', () => {
  it('starts with empty selection, default filters, null draft, and step 0', () => {
    const { result } = renderHook(() => useMeetingStore())
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.filters).toEqual(DEFAULT_MEETING_FILTERS)
    expect(result.current.meetingDraft).toBeNull()
    expect(result.current.wizardStep).toBe(0)
  })

  it('selectMeeting appends an id only once', () => {
    const { result } = renderHook(() => useMeetingStore())
    act(() => result.current.selectMeeting('mtg_1'))
    act(() => result.current.selectMeeting('mtg_1'))
    act(() => result.current.selectMeeting('mtg_2'))
    expect(result.current.selectedIds).toEqual(['mtg_1', 'mtg_2'])
  })

  it('deselectMeeting removes the id', () => {
    const { result } = renderHook(() => useMeetingStore())
    act(() => useMeetingStore.setState({ selectedIds: ['mtg_1', 'mtg_2'] }))
    act(() => result.current.deselectMeeting('mtg_1'))
    expect(result.current.selectedIds).toEqual(['mtg_2'])
  })

  it('clearSelection empties the array', () => {
    const { result } = renderHook(() => useMeetingStore())
    act(() => useMeetingStore.setState({ selectedIds: ['mtg_1', 'mtg_2'] }))
    act(() => result.current.clearSelection())
    expect(result.current.selectedIds).toEqual([])
  })

  it('setFilter merges (does not replace) the existing filter object', () => {
    const { result } = renderHook(() => useMeetingStore())
    act(() => result.current.setFilter({ search: 'standup' }))
    expect(result.current.filters).toEqual({
      search: 'standup',
      status: DEFAULT_MEETING_FILTERS.status,
    })
    act(() => result.current.setFilter({ status: 'recorded' }))
    // search must survive the second setFilter call
    expect(result.current.filters).toEqual({
      search: 'standup',
      status: 'recorded',
    })
  })

  it('resetFilters restores the defaults', () => {
    const { result } = renderHook(() => useMeetingStore())
    act(() =>
      result.current.setFilter({ search: 'x', status: 'recorded' }),
    )
    act(() => result.current.resetFilters())
    expect(result.current.filters).toEqual(DEFAULT_MEETING_FILTERS)
  })

  it('setMeetingDraft sets and clearMeetingDraft nulls the draft', () => {
    const { result } = renderHook(() => useMeetingStore())
    act(() => result.current.setMeetingDraft({ title: 'WIP' }))
    expect(result.current.meetingDraft).toEqual({ title: 'WIP' })
    act(() => result.current.clearMeetingDraft())
    expect(result.current.meetingDraft).toBeNull()
  })

  it('nextStep/prevStep/resetWizard manipulate the step', () => {
    const { result } = renderHook(() => useMeetingStore())
    act(() => result.current.nextStep())
    expect(result.current.wizardStep).toBe(1)
    act(() => result.current.nextStep())
    expect(result.current.wizardStep).toBe(2)
    act(() => result.current.prevStep())
    expect(result.current.wizardStep).toBe(1)
    act(() => result.current.resetWizard())
    expect(result.current.wizardStep).toBe(0)
  })

  it('prevStep clamps at 0', () => {
    const { result } = renderHook(() => useMeetingStore())
    act(() => result.current.prevStep())
    expect(result.current.wizardStep).toBe(0)
  })

  it('partialize excludes selectedIds and wizardStep', () => {
    // The persist middleware writes the partialized subset. We can call
    // the exported partialize fn directly to verify what would be persisted.
    const { partialize } = useMeetingStore.persist.getOptions()
    const persisted = partialize!({
      selectedIds: ['mtg_1'],
      filters: { search: 'x', status: 'recorded' },
      meetingDraft: { title: 'WIP' },
      wizardStep: 3,
      // The function-typed slots are not in the partial-persist shape
      selectMeeting: () => undefined,
      deselectMeeting: () => undefined,
      clearSelection: () => undefined,
      setFilter: () => undefined,
      resetFilters: () => undefined,
      setMeetingDraft: () => undefined,
      clearMeetingDraft: () => undefined,
      nextStep: () => undefined,
      prevStep: () => undefined,
      resetWizard: () => undefined,
    })
    expect(persisted).toEqual({
      filters: { search: 'x', status: 'recorded' },
      meetingDraft: { title: 'WIP' },
    })
    expect(persisted).not.toHaveProperty('selectedIds')
    expect(persisted).not.toHaveProperty('wizardStep')
  })
})
