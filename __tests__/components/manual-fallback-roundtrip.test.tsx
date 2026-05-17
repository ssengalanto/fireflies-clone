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

beforeEach(() => {
  mockUseMeeting.mockReset()
  mockUseTranscribe.mockReset()
  mockUseSave.mockReset()
})

/**
 * Pins SC-004's "no dead-end failure" guarantee: starting from any failure
 * surface, the user can fall back to the manual-entry path and save a
 * usable transcript with the same persistence guarantees as the auto path.
 */
describe('Manual fallback round-trip from a NETWORK failure (US3)', () => {
  it('Network error → Enter manually → type → Save → transcript saved with typed value', async () => {
    mockUseMeeting.mockReturnValue({
      data: {
        id: 'mtg_1',
        title: 'Standup',
        participants: ['alice@example.com'],
        date: '2026-05-17T10:00:00.000Z',
        durationSeconds: 0,
        status: 'draft' as const,
        transcript: null,
        createdAt: '2026-05-17T10:00:00.000Z',
        updatedAt: '2026-05-17T10:00:00.000Z',
      },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as unknown as ReturnType<typeof useMeeting>)

    mockUseTranscribe.mockReturnValue({
      trigger: jest.fn().mockRejectedValue({
        kind: 'NETWORK',
        message: 'socket reset',
      }),
      reset: jest.fn(),
      data: undefined,
      error: { kind: 'NETWORK', message: 'socket reset' },
      isMutating: false,
    })

    const save = jest.fn().mockResolvedValue(undefined)
    mockUseSave.mockReturnValue({
      trigger: save,
      reset: jest.fn(),
      data: undefined,
      error: undefined,
      isMutating: false,
    } as unknown as ReturnType<typeof useUpdateTranscript>)

    const onSettled = jest.fn()

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={new Blob([new Uint8Array(1024)], { type: 'audio/webm' })}
        onSettled={onSettled}
      />,
      { wrapper: createTestWrapper() },
    )

    // Fallback is visible because the hook surfaced a NETWORK error.
    expect(screen.getByText(/could not transcribe/i)).toBeInTheDocument()

    // User chooses manual entry.
    await userEvent.click(
      screen.getByRole('button', { name: /enter manually/i }),
    )

    // The empty editor mounts. Type a transcript and Save.
    const textarea = (await screen.findByLabelText(
      /transcript/i,
    )) as HTMLTextAreaElement
    expect(textarea.value).toBe('')

    const typed = 'Alice: Hi. Bob: Hi back. Let us walk through the redesign.'
    await userEvent.type(textarea, typed)
    expect(textarea.value).toBe(typed)

    await userEvent.click(
      screen.getByRole('button', { name: /save transcript/i }),
    )

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save).toHaveBeenCalledWith(typed)
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1))
  })
})
