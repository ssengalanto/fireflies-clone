import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SummaryView } from '@/components/summary/SummaryView'
import { useSummary, useSummaryStream } from '@/lib/hooks/useSummary'

jest.mock('@/lib/hooks/useSummary')
const mockUseSummary = useSummary as jest.MockedFunction<typeof useSummary>
const mockUseStream = useSummaryStream as jest.MockedFunction<
  typeof useSummaryStream
>

function mockHooks(opts: {
  cached?: string
  text?: string
  isStreaming?: boolean
  error?: Error | null
  generate?: () => Promise<void>
}) {
  mockUseSummary.mockReturnValue({
    data: opts.cached,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn() as any,
  } as ReturnType<typeof useSummary>)
  mockUseStream.mockReturnValue({
    text: opts.text ?? '',
    isStreaming: opts.isStreaming ?? false,
    error: opts.error ?? null,
    generate: opts.generate ?? jest.fn().mockResolvedValue(undefined),
  })
}

const LONG_TRANSCRIPT = 'a'.repeat(60)

beforeEach(() => {
  mockUseSummary.mockReset()
  mockUseStream.mockReset()
})

describe('<SummaryView />', () => {
  it('renders nothing when transcript is null', () => {
    mockHooks({})
    const { container } = render(
      <SummaryView meetingId="mtg_1" transcript={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when transcript is below the minimum length', () => {
    mockHooks({})
    const { container } = render(
      <SummaryView meetingId="mtg_1" transcript="too short" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the cached summary instantly when present, no Generate button', () => {
    mockHooks({ cached: 'A previously cached summary.' })
    render(<SummaryView meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)
    expect(
      screen.getByText('A previously cached summary.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /generate summary/i }),
    ).not.toBeInTheDocument()
  })

  it('renders the Generate button when there is no cached summary and nothing streaming', () => {
    mockHooks({})
    render(<SummaryView meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)
    expect(
      screen.getByRole('button', { name: /generate summary/i }),
    ).toBeInTheDocument()
  })

  it('invokes generate() when the user clicks Generate', async () => {
    const generate = jest.fn().mockResolvedValue(undefined)
    mockHooks({ generate })
    render(<SummaryView meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)

    await userEvent.click(
      screen.getByRole('button', { name: /generate summary/i }),
    )
    expect(generate).toHaveBeenCalled()
  })

  it('renders streaming text as it accumulates and shows an in-progress indicator', () => {
    mockHooks({ text: 'Hello stream', isStreaming: true })
    render(<SummaryView meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)
    expect(screen.getByText(/hello stream/i)).toBeInTheDocument()
    expect(screen.getByText(/generating/i)).toBeInTheDocument()
  })

  it('renders the error message with a Retry button on failure', async () => {
    const generate = jest.fn().mockResolvedValue(undefined)
    mockHooks({
      error: new Error('Failed to generate summary'),
      generate,
    })
    render(<SummaryView meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)

    expect(screen.getByText(/failed to generate summary/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(generate).toHaveBeenCalled()
  })
})
