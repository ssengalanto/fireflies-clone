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

function meetingWithoutTranscript() {
  return {
    id: 'mtg_1',
    title: 'Standup',
    participants: ['alice@example.com'],
    date: '2026-05-17T10:00:00.000Z',
    durationSeconds: 0,
    status: 'draft' as const,
    transcript: null,
    createdAt: '2026-05-17T10:00:00.000Z',
    updatedAt: '2026-05-17T10:00:00.000Z',
  }
}

beforeEach(() => {
  mockUseMeeting.mockReset()
  mockUseTranscribe.mockReset()
  mockUseSave.mockReset()
})

describe('Auto-transcription → review → edit → save round-trip (US2)', () => {
  it('persists the user-edited text, not the raw auto-produced text', async () => {
    const transcribe = jest.fn().mockResolvedValue({
      transcript: 'Auto produced text with mistake.',
      durationSeconds: 5,
    })
    const save = jest.fn().mockResolvedValue(undefined)
    const onSettled = jest.fn()

    mockUseMeeting.mockReturnValue({
      data: meetingWithoutTranscript(),
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

    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={blob}
        onSettled={onSettled}
      />,
      { wrapper: createTestWrapper() },
    )

    // Auto path fires once.
    await waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1))

    const textarea = (await screen.findByLabelText(
      /transcript/i,
    )) as HTMLTextAreaElement
    expect(textarea.value).toBe('Auto produced text with mistake.')

    // The user fixes the typo before saving.
    await userEvent.clear(textarea)
    await userEvent.type(
      textarea,
      'Auto produced text without mistake.',
    )
    expect(textarea.value).toBe('Auto produced text without mistake.')

    await userEvent.click(
      screen.getByRole('button', { name: /save transcript/i }),
    )

    // The trigger receives the EDITED string, not the raw produced one.
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save).toHaveBeenCalledWith('Auto produced text without mistake.')
    expect(save).not.toHaveBeenCalledWith('Auto produced text with mistake.')

    // After save resolves, onSettled fires so the parent can clear the
    // pending audio blob.
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1))
  })
})
