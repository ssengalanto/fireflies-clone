import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TranscriptionReview } from '@/components/transcript/TranscriptionReview'
import { useMeeting } from '@/lib/hooks/useMeeting'
import { useTranscribeRecording } from '@/lib/hooks/useTranscribeRecording'
import { useUpdateTranscript } from '@/lib/hooks/useUpdateTranscript'

import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/hooks/useMeeting')
jest.mock('@/lib/hooks/useTranscribeRecording')
jest.mock('@/lib/hooks/useUpdateTranscript')

const mockUseMeeting = useMeeting as jest.MockedFunction<typeof useMeeting>
const mockUseTranscribe = useTranscribeRecording as jest.MockedFunction<
  typeof useTranscribeRecording
>
const mockUseSave = useUpdateTranscript as jest.MockedFunction<
  typeof useUpdateTranscript
>

interface SetupOpts {
  meeting?: { id?: string; transcript?: string | null } | null
  transcribeResult?: { transcript: string; durationSeconds: number }
  isMutating?: boolean
}

function setup(opts: SetupOpts = {}) {
  const transcribe = jest
    .fn()
    .mockResolvedValue(
      opts.transcribeResult ?? { transcript: 'Alice: hi.', durationSeconds: 5 },
    )
  const save = jest.fn().mockResolvedValue(undefined)

  mockUseMeeting.mockReturnValue({
    data: opts.meeting === null ? undefined : {
      id: opts.meeting?.id ?? 'mtg_1',
      title: 'Standup',
      participants: ['alice@example.com'],
      date: '2026-05-17T10:00:00.000Z',
      durationSeconds: 0,
      status: 'draft' as const,
      transcript: opts.meeting?.transcript ?? null,
      createdAt: '2026-05-17T10:00:00.000Z',
      updatedAt: '2026-05-17T10:00:00.000Z',
    },
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn(),
  } as unknown as ReturnType<typeof useMeeting>)

  mockUseTranscribe.mockReturnValue({
    trigger: transcribe,
    reset: jest.fn(),
    data: undefined,
    error: undefined,
    isMutating: opts.isMutating ?? false,
  })

  mockUseSave.mockReturnValue({
    trigger: save,
    reset: jest.fn(),
    data: undefined,
    error: undefined,
    isMutating: false,
  } as unknown as ReturnType<typeof useUpdateTranscript>)

  return { transcribe, save }
}

function makeBlob(): Blob {
  return new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
}

beforeEach(() => {
  mockUseMeeting.mockReset()
  mockUseTranscribe.mockReset()
  mockUseSave.mockReset()
})

describe('TranscriptionReview — review-then-save (US2)', () => {
  it('does not fire transcribe when audioBlob is null', () => {
    const { transcribe } = setup()
    const onSettled = jest.fn()
    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={null}
        onSettled={onSettled}
      />,
      { wrapper: createTestWrapper() },
    )
    expect(transcribe).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
  })

  it('fires transcribe exactly once and does NOT auto-save', async () => {
    const { transcribe, save } = setup()
    const onSettled = jest.fn()
    const blob = makeBlob()
    const wrapper = createTestWrapper()

    const { rerender } = render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={null}
        onSettled={onSettled}
      />,
      { wrapper },
    )
    expect(transcribe).not.toHaveBeenCalled()

    rerender(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={blob}
        onSettled={onSettled}
      />,
    )

    await waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1))
    expect(transcribe).toHaveBeenCalledWith(blob)

    // Crucially: save must NOT fire automatically. The user has to confirm
    // via the editor's Save button (US2 review gate).
    await waitFor(() => expect(transcribe).toHaveBeenCalled())
    expect(save).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
  })

  it('mounts TranscriptEditor with the produced text as initialValue after transcribe resolves', async () => {
    setup({
      transcribeResult: { transcript: 'Auto-produced text.', durationSeconds: 5 },
    })

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )

    const textarea = (await screen.findByLabelText(/transcript/i)) as
      | HTMLTextAreaElement
      | HTMLInputElement
    expect(textarea.value).toBe('Auto-produced text.')
  })

  it('calls onSettled when the editor reports onSaved (user confirmed the edit)', async () => {
    const { save } = setup({
      transcribeResult: { transcript: 'Auto-produced text.', durationSeconds: 5 },
    })
    save.mockResolvedValue(undefined)
    const onSettled = jest.fn()

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={onSettled}
      />,
      { wrapper: createTestWrapper() },
    )

    await screen.findByLabelText(/transcript/i)

    // The editor's Save button submits the form, which awaits trigger()
    // (mocked save) and then calls onSaved → onSettled.
    await userEvent.click(screen.getByRole('button', { name: /save transcript/i }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1))
  })

  it('discarding without saving (unmount) leaves the meeting transcript untouched', async () => {
    const { save } = setup({
      transcribeResult: { transcript: 'Auto-produced text.', durationSeconds: 5 },
    })
    const onSettled = jest.fn()

    const { unmount } = render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={onSettled}
      />,
      { wrapper: createTestWrapper() },
    )

    await screen.findByLabelText(/transcript/i)
    unmount()

    expect(save).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
  })

  it('renders a role="status" in-progress indicator while isMutating', () => {
    setup({ isMutating: true })
    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does not re-fire transcribe on a re-render with the same blob', async () => {
    const { transcribe } = setup()
    const onSettled = jest.fn()
    const blob = makeBlob()
    const wrapper = createTestWrapper()

    const { rerender } = render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={blob}
        onSettled={onSettled}
      />,
      { wrapper },
    )
    await waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1))

    rerender(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={blob}
        onSettled={onSettled}
      />,
    )
    rerender(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={blob}
        onSettled={onSettled}
      />,
    )
    expect(transcribe).toHaveBeenCalledTimes(1)
  })
})
