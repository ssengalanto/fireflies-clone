import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TranscriptionReview } from '@/components/transcript/TranscriptionReview'
import type { TranscriptionError } from '@/lib/fetchers/transcribe.fetcher'
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

function meetingNoTranscript() {
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

function setupWithError(error: TranscriptionError) {
  const trigger = jest.fn().mockRejectedValue(error)
  const reset = jest.fn()
  const save = jest.fn().mockResolvedValue(undefined)

  mockUseMeeting.mockReturnValue({
    data: meetingNoTranscript(),
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn(),
  } as unknown as ReturnType<typeof useMeeting>)

  mockUseTranscribe.mockReturnValue({
    trigger,
    reset,
    data: undefined,
    error,
    isMutating: false,
  })

  mockUseSave.mockReturnValue({
    trigger: save,
    reset: jest.fn(),
    data: undefined,
    error: undefined,
    isMutating: false,
  } as unknown as ReturnType<typeof useUpdateTranscript>)

  return { trigger, reset, save }
}

function makeBlob(): Blob {
  return new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
}

beforeEach(() => {
  mockUseMeeting.mockReset()
  mockUseTranscribe.mockReset()
  mockUseSave.mockReset()
})

describe('TranscriptionReview — failure fallback (US3)', () => {
  it('renders TranscriptionFallback when the hook surfaces an error', () => {
    setupWithError({ kind: 'NETWORK', message: 'socket reset' })
    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/could not transcribe/i)).toBeInTheDocument()
  })

  it('does NOT render the TranscriptEditor while a fallback is shown', () => {
    setupWithError({ kind: 'NETWORK', message: 'x' })
    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )
    expect(screen.queryByLabelText(/transcript/i)).not.toBeInTheDocument()
  })

  it('Retry: resets the hook and re-fires trigger(audioBlob)', async () => {
    const { trigger, reset } = setupWithError({
      kind: 'PROVIDER',
      message: 'upstream',
    })
    const blob = makeBlob()
    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={blob}
        onSettled={jest.fn()}
      />,
      { wrapper: createTestWrapper() },
    )

    // The first invocation runs from the mount effect.
    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(reset).toHaveBeenCalled()
    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
    expect(trigger).toHaveBeenLastCalledWith(blob)
  })

  it('Enter manually: shows an empty TranscriptEditor; does NOT call onSettled yet', async () => {
    setupWithError({ kind: 'NETWORK', message: 'x' })
    const onSettled = jest.fn()
    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={onSettled}
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

    // The fallback is gone now.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // The blob is intentionally left in place — the user has not yet saved.
    expect(onSettled).not.toHaveBeenCalled()
  })

  it('Re-record: calls the onReRecord prop so the parent can reset the recorder', async () => {
    setupWithError({ kind: 'NETWORK', message: 'x' })
    const onSettled = jest.fn()
    const onReRecord = jest.fn()

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={onSettled}
        onReRecord={onReRecord}
      />,
      { wrapper: createTestWrapper() },
    )

    await userEvent.click(screen.getByRole('button', { name: /re-record/i }))

    expect(onReRecord).toHaveBeenCalledTimes(1)
  })

  it('Re-record without an onReRecord prop falls back to onSettled', async () => {
    setupWithError({ kind: 'NETWORK', message: 'x' })
    const onSettled = jest.fn()

    render(
      <TranscriptionReview
        meetingId="mtg_1"
        audioBlob={makeBlob()}
        onSettled={onSettled}
      />,
      { wrapper: createTestWrapper() },
    )

    await userEvent.click(screen.getByRole('button', { name: /re-record/i }))

    expect(onSettled).toHaveBeenCalledTimes(1)
  })
})
