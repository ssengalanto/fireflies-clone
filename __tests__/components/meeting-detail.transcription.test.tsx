import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
  it('flows audioBlob from RecordingControls → TranscriptionReview → produced text in the editor (no auto-save)', async () => {
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
    // → TranscriptionReview's effect → transcribe(blob). Under US2 the
    // result then lands in TranscriptEditor as initialValue (no auto-save).
    await waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1))
    expect(transcribe).toHaveBeenCalledWith(blob)

    // The (now multiple) TranscriptEditor instances on this page all share
    // the same label; the auto-populated one carries the produced text.
    await waitFor(() => {
      const textareas = screen.getAllByLabelText(
        /transcript/i,
      ) as HTMLTextAreaElement[]
      expect(
        textareas.some((t) => t.value === 'Auto-produced transcript.'),
      ).toBe(true)
    })

    // Save must NOT fire automatically — that's the whole point of US2.
    expect(save).not.toHaveBeenCalled()
  })

  it('drops the stale auto-produced transcript when the user clicks Re-record', async () => {
    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
    const transcribe = jest.fn().mockResolvedValue({
      transcript: 'Stale produced transcript.',
      durationSeconds: 7,
    })
    const start = jest.fn().mockResolvedValue(undefined)

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
      audioBlob: blob,
      start: start as any,
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
      trigger: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
      data: undefined,
      error: undefined,
      isMutating: false,
    } as unknown as ReturnType<typeof useUpdateTranscript>)

    render(<MeetingDetailPage params={{ id: 'mtg_1' }} />, {
      wrapper: createTestWrapper(),
    })

    // The auto-produced text lands in one of the editors.
    await waitFor(() => {
      const textareas = screen.getAllByLabelText(
        /transcript/i,
      ) as HTMLTextAreaElement[]
      expect(
        textareas.some((t) => t.value === 'Stale produced transcript.'),
      ).toBe(true)
    })

    // User clicks Re-record (the button shown by RecordingControls in the
    // stopped state). After that, the stale produced text must no longer be
    // sitting in any transcript editor on the page — the user expects a
    // clean slate to re-record into.
    await userEvent.click(screen.getByRole('button', { name: /re-record/i }))

    await waitFor(() => {
      const textareas = screen.queryAllByLabelText(
        /transcript/i,
      ) as HTMLTextAreaElement[]
      expect(
        textareas.some((t) => t.value === 'Stale produced transcript.'),
      ).toBe(false)
    })
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
