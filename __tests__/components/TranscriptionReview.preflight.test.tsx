import { render, screen, waitFor } from '@testing-library/react'

import { TranscriptionReview } from '@/components/transcript/TranscriptionReview'
import { MAX_AUDIO_BYTES } from '@/lib/fetchers/transcribe.fetcher'
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
  ;(global.fetch as jest.Mock | undefined)?.mockReset?.()
})

/**
 * The 25 MB pre-flight cap is enforced in the fetcher and surfaces to the
 * hook as `error: { kind: 'TOO_LARGE' }`. From the component's
 * perspective the result is the same as any other failed mutation —
 * `TranscriptionFallback` renders with the right copy and hides Retry.
 *
 * This test pins that behaviour at the component layer; the byte-cap math
 * itself is exhaustively covered in
 * `__tests__/fetchers/transcribe.fetcher.test.ts`.
 */
describe('TranscriptionReview — pre-flight oversize guard (US3)', () => {
  it('renders the TOO_LARGE fallback without retry when audio exceeds the cap', async () => {
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

    const trigger = jest.fn().mockRejectedValue({
      kind: 'TOO_LARGE',
      message: 'Recording is too long. Maximum size is 25 MB.',
    })
    mockUseTranscribe.mockReturnValue({
      trigger,
      reset: jest.fn(),
      data: undefined,
      error: { kind: 'TOO_LARGE', message: 'too big' },
      isMutating: false,
    })
    mockUseSave.mockReturnValue({
      trigger: jest.fn(),
      reset: jest.fn(),
      data: undefined,
      error: undefined,
      isMutating: false,
    } as unknown as ReturnType<typeof useUpdateTranscript>)

    const tooBig = new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], {
      type: 'audio/webm',
    })

    // Set up a fetch spy specifically to confirm the network was never
    // touched — the fetcher's pre-flight rejects before fetch is built.
    const fetchSpy = jest.fn()
    ;(global as unknown as { fetch: typeof fetch }).fetch =
      fetchSpy as unknown as typeof fetch

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={tooBig}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )

    expect(screen.getByText(/recording is too long/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /enter manually/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /re-record/i }),
    ).toBeInTheDocument()

    // The hook's trigger gets called (the auto effect fires), but the
    // fetcher would have pre-flight-rejected. Fetch must never run.
    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
