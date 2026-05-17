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

function setupWithExisting(existingTranscript: string) {
  const transcribe = jest
    .fn()
    .mockResolvedValue({ transcript: 'fresh text', durationSeconds: 5 })
  const save = jest.fn().mockResolvedValue(undefined)

  mockUseMeeting.mockReturnValue({
    data: {
      id: 'mtg_1',
      title: 'Standup',
      participants: ['alice@example.com'],
      date: '2026-05-17T10:00:00.000Z',
      durationSeconds: 0,
      status: 'recorded' as const,
      transcript: existingTranscript,
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
    isMutating: false,
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

describe('TranscriptionReview — replace-confirm (US1)', () => {
  it('opens the replace dialog when the meeting already has a transcript and a new blob arrives', () => {
    setupWithExisting('Existing transcript.')

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )

    expect(
      screen.getByRole('heading', { name: /replace existing transcript/i }),
    ).toBeInTheDocument()
  })

  it('does NOT fire transcribe while the replace dialog is open', () => {
    const { transcribe } = setupWithExisting('Existing transcript.')

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )

    expect(transcribe).not.toHaveBeenCalled()
  })

  it('Replace → fires transcribe with the pending blob', async () => {
    const { transcribe, save } = setupWithExisting('Existing transcript.')
    const onSettled = jest.fn()
    const blob = makeBlob()

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={blob}
        onSettled={onSettled}
      />,
      { wrapper: createTestWrapper() },
    )

    await userEvent.click(screen.getByRole('button', { name: /replace/i }))

    await waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1))
    expect(transcribe).toHaveBeenCalledWith(blob)
    await waitFor(() => expect(save).toHaveBeenCalledWith('fresh text'))
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1))
  })

  it('Keep current → no transcribe call; onSettled fires so the parent can clear the blob', async () => {
    const { transcribe, save } = setupWithExisting('Existing transcript.')
    const onSettled = jest.fn()

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={onSettled}
      />,
      { wrapper: createTestWrapper() },
    )

    await userEvent.click(screen.getByRole('button', { name: /keep current/i }))

    expect(transcribe).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('does NOT open the dialog when the existing transcript is whitespace-only', () => {
    setupWithExisting('   ')

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )

    expect(
      screen.queryByRole('heading', { name: /replace existing transcript/i }),
    ).not.toBeInTheDocument()
  })
})
