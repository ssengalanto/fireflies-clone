import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ActionItems } from '@/components/summary/ActionItems'
import { useActionItems } from '@/lib/hooks/useActionItems'

jest.mock('@/lib/hooks/useActionItems')
const mockHook = useActionItems as jest.MockedFunction<typeof useActionItems>

function setup(opts: {
  data?: ReturnType<typeof useActionItems>['data']
  isExtracting?: boolean
  error?: Error | null
  extract?: () => Promise<void>
}) {
  mockHook.mockReturnValue({
    data: opts.data,
    extract: opts.extract ?? jest.fn().mockResolvedValue(undefined),
    isExtracting: opts.isExtracting ?? false,
    error: opts.error ?? null,
  })
}

const LONG_TRANSCRIPT = 'a'.repeat(60)

beforeEach(() => {
  mockHook.mockReset()
})

describe('<ActionItems />', () => {
  it('renders nothing when transcript is null', () => {
    setup({})
    const { container } = render(
      <ActionItems meetingId="mtg_1" transcript={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when transcript is below the minimum length', () => {
    setup({})
    const { container } = render(
      <ActionItems meetingId="mtg_1" transcript="too short" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the cached list with one <li> per item', () => {
    setup({
      data: [
        { id: 'ai_1', text: 'Send the deck', owner: null, dueDate: null },
        {
          id: 'ai_2',
          text: 'Follow up with Bob',
          owner: 'alice@example.com',
          dueDate: '2026-05-22T00:00:00.000Z',
        },
      ],
    })

    render(<ActionItems meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(screen.getByText('Send the deck')).toBeInTheDocument()
    expect(screen.getByText('Follow up with Bob')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('renders an empty-state notice when extraction produced no items', () => {
    setup({ data: [] })
    render(<ActionItems meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)
    expect(
      screen.getByText(/no action items extracted/i),
    ).toBeInTheDocument()
  })

  it('renders the Extract button when there is no cached data', () => {
    setup({ data: undefined })
    render(<ActionItems meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)
    expect(
      screen.getByRole('button', { name: /extract action items/i }),
    ).toBeInTheDocument()
  })

  it('invokes extract() when the user clicks the button', async () => {
    const extract = jest.fn().mockResolvedValue(undefined)
    setup({ data: undefined, extract })
    render(<ActionItems meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)

    await userEvent.click(
      screen.getByRole('button', { name: /extract action items/i }),
    )
    expect(extract).toHaveBeenCalled()
  })

  it('disables the button while isExtracting', () => {
    setup({ data: undefined, isExtracting: true })
    render(<ActionItems meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)
    expect(
      screen.getByRole('button', { name: /extracting/i }),
    ).toBeDisabled()
  })

  it('renders the error state with a Retry button on failure', async () => {
    const extract = jest.fn().mockResolvedValue(undefined)
    setup({
      data: undefined,
      error: new Error('Failed to extract action items'),
      extract,
    })
    render(<ActionItems meetingId="mtg_1" transcript={LONG_TRANSCRIPT} />)

    expect(screen.getByText(/failed to extract action items/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(extract).toHaveBeenCalled()
  })
})
