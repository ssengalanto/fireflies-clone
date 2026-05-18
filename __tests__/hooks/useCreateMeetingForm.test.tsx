import { act, renderHook, waitFor } from '@testing-library/react'

import { useCreateMeeting } from '@/lib/hooks/useCreateMeeting'
import { useCreateMeetingForm } from '@/lib/hooks/useCreateMeetingForm'
import { useMeetingStore } from '@/lib/store/meetingStore'
import { useUIStore } from '@/lib/store/uiStore'

import { resetStores } from '../utils/stores'
import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/hooks/useCreateMeeting')
const mockUseCreate = useCreateMeeting as jest.MockedFunction<
  typeof useCreateMeeting
>

const created = {
  id: 'mtg_new',
  title: 'Standup',
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
  durationSeconds: 0,
  status: 'draft' as const,
  transcript: null,
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
}

beforeEach(() => {
  resetStores()
  mockUseCreate.mockReset()
})

describe('useCreateMeetingForm', () => {
  it('hydrates the form from meetingDraft on mount', () => {
    useMeetingStore.setState({
      meetingDraft: {
        title: 'Draft title',
        participants: ['draft@example.com'],
        date: '2026-05-17T10:00:00.000Z',
      },
    })
    mockUseCreate.mockReturnValue({ create: jest.fn(), isCreating: false })

    const { result } = renderHook(() => useCreateMeetingForm(), {
      wrapper: createTestWrapper(),
    })
    const values = result.current.form.getValues()
    expect(values.title).toBe('Draft title')
    expect(values.participants).toEqual(['draft@example.com'])
  })

  it('syncs every form change back into meetingStore.meetingDraft', async () => {
    mockUseCreate.mockReturnValue({ create: jest.fn(), isCreating: false })

    const { result } = renderHook(() => useCreateMeetingForm(), {
      wrapper: createTestWrapper(),
    })

    act(() => result.current.form.setValue('title', 'Live update'))

    await waitFor(() => {
      expect(useMeetingStore.getState().meetingDraft?.title).toBe('Live update')
    })
  })

  it('blocks invalid submit (empty title) and does not call create', async () => {
    const create = jest.fn().mockResolvedValue(created)
    mockUseCreate.mockReturnValue({ create, isCreating: false })

    const { result } = renderHook(() => useCreateMeetingForm(), {
      wrapper: createTestWrapper(),
    })

    // Default participants includes one empty string; set title empty.
    act(() => result.current.form.setValue('title', ''))
    act(() => result.current.form.setValue('participants', ['']))

    await act(async () => {
      await result.current.onSubmit()
    })
    expect(create).not.toHaveBeenCalled()

    // Verify the schema is the blocker. `formState.errors` is a tracked
    // proxy and doesn't expose anything to a test that hasn't subscribed
    // via render; `trigger()` re-runs validation and returns a boolean.
    let isValid: boolean | undefined
    await act(async () => {
      isValid = await result.current.form.trigger()
    })
    expect(isValid).toBe(false)
  })

  it('on successful submit calls create, then resets form, clears draft, closes modal', async () => {
    const create = jest.fn().mockResolvedValue(created)
    mockUseCreate.mockReturnValue({ create, isCreating: false })

    // Future-dated so the new past-date refine on `createMeetingSchema` lets
    // this submit succeed. The "is the form wired to create()" assertion
    // doesn't care about which valid date we pick.
    const futureDate = '2030-01-01T10:00:00.000Z'
    useMeetingStore.setState({
      meetingDraft: {
        title: 'Standup',
        participants: ['alice@example.com'],
        date: futureDate,
      },
    })
    useUIStore.setState({ activeModal: 'new-meeting' })

    const { result } = renderHook(() => useCreateMeetingForm(), {
      wrapper: createTestWrapper(),
    })

    await act(async () => {
      await result.current.onSubmit()
    })

    expect(create).toHaveBeenCalledWith({
      title: 'Standup',
      participants: ['alice@example.com'],
      date: futureDate,
    })
    expect(useMeetingStore.getState().meetingDraft).toBeNull()
    expect(useUIStore.getState().activeModal).toBeNull()
  })

  it('exposes isPending from the underlying create hook', () => {
    mockUseCreate.mockReturnValue({ create: jest.fn(), isCreating: true })

    const { result } = renderHook(() => useCreateMeetingForm(), {
      wrapper: createTestWrapper(),
    })
    expect(result.current.isPending).toBe(true)
  })
})
