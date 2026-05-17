import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TranscriptEditor } from '@/components/transcript/TranscriptEditor'
import { useUpdateTranscript } from '@/lib/hooks/useUpdateTranscript'

jest.mock('@/lib/hooks/useUpdateTranscript')
const mockUseUpdate = useUpdateTranscript as jest.MockedFunction<
  typeof useUpdateTranscript
>

const updatedMeeting = {
  id: 'mtg_1',
  title: 'Standup',
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
  durationSeconds: 0,
  status: 'recorded' as const,
  transcript: 'hello',
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T11:00:00.000Z',
}

function mockHook(overrides: Partial<ReturnType<typeof useUpdateTranscript>> = {}) {
  mockUseUpdate.mockReturnValue({
    trigger: jest.fn().mockResolvedValue(updatedMeeting) as any,
    isMutating: false,
    data: undefined,
    error: undefined,
    reset: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useUpdateTranscript>)
}

beforeEach(() => {
  mockUseUpdate.mockReset()
})

describe('<TranscriptEditor />', () => {
  it('calls trigger with the textarea value on submit', async () => {
    const trigger = jest.fn().mockResolvedValue(updatedMeeting)
    mockHook({ trigger: trigger as any })
    render(<TranscriptEditor meetingId="mtg_1" />)

    await userEvent.type(
      screen.getByRole('textbox', { name: /transcript/i }),
      'Alice: hi.',
    )
    await userEvent.click(screen.getByRole('button', { name: /save transcript/i }))

    await waitFor(() => expect(trigger).toHaveBeenCalledWith('Alice: hi.'))
  })

  it('disables the submit button while isMutating', () => {
    mockHook({ isMutating: true })
    render(<TranscriptEditor meetingId="mtg_1" />)
    expect(
      screen.getByRole('button', { name: /saving|save/i }),
    ).toBeDisabled()
  })

  it('blocks empty-string submit with an inline error', async () => {
    const trigger = jest.fn()
    mockHook({ trigger: trigger as any })
    render(<TranscriptEditor meetingId="mtg_1" />)

    await userEvent.click(
      screen.getByRole('button', { name: /save transcript/i }),
    )
    expect(trigger).not.toHaveBeenCalled()
    expect(
      await screen.findByText(/transcript cannot be empty/i),
    ).toBeInTheDocument()
  })
})
