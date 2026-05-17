import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RecordingControls } from '@/components/recording/RecordingControls'
import { useRecording } from '@/lib/hooks/useRecording'

jest.mock('@/lib/hooks/useRecording')
const mockUseRecording = useRecording as jest.MockedFunction<typeof useRecording>

function mockHook(overrides: Partial<ReturnType<typeof useRecording>> = {}) {
  mockUseRecording.mockReturnValue({
    status: 'idle',
    elapsed: 0,
    audioBlob: null,
    start: jest.fn().mockResolvedValue(undefined) as any,
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useRecording>)
}

beforeEach(() => {
  mockUseRecording.mockReset()
})

describe('<RecordingControls />', () => {
  it('shows a Start button initially', () => {
    mockHook()
    render(<RecordingControls onAudioBlob={jest.fn()} />)
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /stop/i }),
    ).not.toBeInTheDocument()
  })

  it('calls start() when the user clicks Start', async () => {
    const start = jest.fn().mockResolvedValue(undefined)
    mockHook({ start: start as any })
    render(<RecordingControls onAudioBlob={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /start/i }))
    expect(start).toHaveBeenCalled()
  })

  it('shows a Stop button and the timer once status is "recording"', () => {
    mockHook({ status: 'recording', elapsed: 42 })
    render(<RecordingControls onAudioBlob={jest.fn()} />)
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
    expect(screen.getByText('0:42')).toBeInTheDocument()
  })

  it('formats elapsed seconds as M:SS', () => {
    mockHook({ status: 'recording', elapsed: 125 })
    render(<RecordingControls onAudioBlob={jest.fn()} />)
    expect(screen.getByText('2:05')).toBeInTheDocument()
  })
})
