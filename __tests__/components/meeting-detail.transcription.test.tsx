import { render, screen, waitFor } from '@testing-library/react'

import MeetingDetailPage from '@/app/(dashboard)/meetings/[id]/page'
import { useMeeting } from '@/lib/hooks/useMeeting'
import { useRecording } from '@/lib/hooks/useRecording'
import { useTranscribeRecording } from '@/lib/hooks/useTranscribeRecording'
import { useUpdateTranscript } from '@/lib/hooks/useUpdateTranscript'

import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/hooks/useMeeting')
jest.mock('@/lib/hooks/useRecording')
jest.mock('@/lib/hooks/useTranscribeRecording')
jest.mock('@/lib/hooks/useUpdateTranscript')

const mockUseMeeting = useMeeting as jest.MockedFunction<typeof useMeeting>
const mockUseRecording = useRecording as jest.MockedFunction<typeof useRecording>
const mockUseTranscribe = useTranscribeRecording as jest.MockedFunction<
  typeof useTranscribeRecording
>
const mockUseSave = useUpdateTranscript as jest.MockedFunction<
  typeof useUpdateTranscript
>

function meeting(transcript: string | null) {
  return {
    id: 'mtg_1',
    title: 'Standup',
    participants: ['alice@example.com'],
    date: '2026-05-17T10:00:00.000Z',
    durationSeconds: 0,
    status: 'draft' as const,
    transcript,
    createdAt: '2026-05-17T10:00:00.000Z',
    updatedAt: '2026-05-17T10:00:00.000Z',
  }
}

beforeEach(() => {
  mockUseMeeting.mockReset()
  mockUseRecording.mockReset()
  mockUseTranscribe.mockReset()
  mockUseSave.mockReset()
})

describe('Meeting detail page — auto-transcription wiring', () => {
  it('flows audioBlob from RecordingControls → TranscriptionReview → PATCH transcript', async () => {
    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
    const transcribe = jest.fn().mockResolvedValue({
      transcript: 'Auto-produced transcript.',
      durationSeconds: 7,
    })
    const save = jest.fn().mockResolvedValue(undefined)

    mockUseMeeting.mockReturnValue({
      data: meeting(null),
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as unknown as ReturnType<typeof useMeeting>)

    // Simulate: the user just stopped a recording — useRecording exposes a
    // ready Blob. RecordingControls' internal useEffect will call onAudioBlob
    // on mount because audioBlob is already non-null.
    mockUseRecording.mockReturnValue({
      status: 'stopped',
      elapsed: 12,
      audioBlob: blob,
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      clearAudio: jest.fn(),
    })

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

    render(<MeetingDetailPage params={{ id: 'mtg_1' }} />, {
      wrapper: createTestWrapper(),
    })

    // The page should show the v1 "capture" step (no transcript yet).
    expect(
      screen.getByRole('heading', { name: /capture this meeting/i }),
    ).toBeInTheDocument()

    // RecordingControls' useEffect fires onAudioBlob(blob) → setPendingAudio
    // → TranscriptionReview's effect → transcribe(blob) → save(transcript).
    await waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1))
    expect(transcribe).toHaveBeenCalledWith(blob)
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith('Auto-produced transcript.'),
    )
  })

  it('renders the in-progress indicator while isMutating', () => {
    mockUseMeeting.mockReturnValue({
      data: meeting(null),
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as unknown as ReturnType<typeof useMeeting>)

    mockUseRecording.mockReturnValue({
      status: 'stopped',
      elapsed: 12,
      audioBlob: new Blob([new Uint8Array(1024)], { type: 'audio/webm' }),
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      clearAudio: jest.fn(),
    })

    mockUseTranscribe.mockReturnValue({
      trigger: jest.fn().mockReturnValue(new Promise(() => {})),
      reset: jest.fn(),
      data: undefined,
      error: undefined,
      isMutating: true,
    })

    mockUseSave.mockReturnValue({
      trigger: jest.fn(),
      reset: jest.fn(),
      data: undefined,
      error: undefined,
      isMutating: false,
    } as unknown as ReturnType<typeof useUpdateTranscript>)

    render(<MeetingDetailPage params={{ id: 'mtg_1' }} />, {
      wrapper: createTestWrapper(),
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
