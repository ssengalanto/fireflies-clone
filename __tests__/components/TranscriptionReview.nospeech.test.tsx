import { render, screen } from '@testing-library/react'
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
 * Pins the distinct NO_SPEECH state at the component layer: a recording
 * that produced no detectable speech is *not* a saved empty transcript
 * (FR-012). The user gets the same Re-record + Enter manually choices and
 * Retry is hidden — retrying with silent audio would fail the same way.
 */
describe('TranscriptionReview — no-speech fallback (US3)', () => {
  it('shows the NO_SPEECH copy and hides Retry', () => {
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
        kind: 'NO_SPEECH',
        message: 'No speech detected',
      }),
      reset: jest.fn(),
      data: undefined,
      error: { kind: 'NO_SPEECH', message: 'No speech detected' },
      isMutating: false,
    })

    mockUseSave.mockReturnValue({
      trigger: jest.fn(),
      reset: jest.fn(),
      data: undefined,
      error: undefined,
      isMutating: false,
    } as unknown as ReturnType<typeof useUpdateTranscript>)

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={new Blob([new Uint8Array(1024)], { type: 'audio/webm' })}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )

    expect(screen.getByText(/no speech detected/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
  })

  it('Enter manually opens an empty editor — the recorded audio is not saved as a blank transcript', async () => {
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

    const save = jest.fn()
    mockUseTranscribe.mockReturnValue({
      trigger: jest.fn().mockRejectedValue({
        kind: 'NO_SPEECH',
        message: 'No speech detected',
      }),
      reset: jest.fn(),
      data: undefined,
      error: { kind: 'NO_SPEECH', message: 'No speech detected' },
      isMutating: false,
    })
    mockUseSave.mockReturnValue({
      trigger: save,
      reset: jest.fn(),
      data: undefined,
      error: undefined,
      isMutating: false,
    } as unknown as ReturnType<typeof useUpdateTranscript>)

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={new Blob([new Uint8Array(1024)], { type: 'audio/webm' })}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )

    await userEvent.click(
      screen.getByRole('button', { name: /enter manually/i }),
    )

    const textarea = (await screen.findByLabelText(
      /transcript/i,
    )) as HTMLTextAreaElement
    expect(textarea.value).toBe('')
    expect(save).not.toHaveBeenCalled()
  })
})
