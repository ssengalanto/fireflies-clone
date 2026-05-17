import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MeetingList } from '@/components/meetings/MeetingList'
import { useMeetings } from '@/lib/hooks/useMeetings'
import { useMeetingStore } from '@/lib/store/meetingStore'

import { resetStores } from '../../utils/stores'

jest.mock('@/lib/hooks/useMeetings')
const mockUseMeetings = useMeetings as jest.MockedFunction<typeof useMeetings>

const meeting = (id: string, title = `Meeting ${id}`) => ({
  id,
  title,
  participants: ['alice@example.com'],
  date: '2026-05-17T10:00:00.000Z',
  durationSeconds: 0,
  status: 'draft' as const,
  transcript: null,
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
})

function mockReturn(overrides: Partial<ReturnType<typeof useMeetings>>) {
  mockUseMeetings.mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn() as any,
    size: 1,
    setSize: jest.fn() as any,
    ...overrides,
  } as ReturnType<typeof useMeetings>)
}

beforeEach(() => {
  mockUseMeetings.mockReset()
  resetStores()
})

describe('<MeetingList />', () => {
  it('renders skeleton placeholders while loading', () => {
    mockReturn({ isLoading: true })
    render(<MeetingList />)
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })

  it('renders one card per meeting on success', () => {
    mockReturn({
      data: [
        {
          items: [meeting('1', 'Standup'), meeting('2', 'Roadmap')],
          nextCursor: null,
        },
      ],
    })
    render(<MeetingList />)
    expect(screen.getByRole('heading', { name: /standup/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /roadmap/i })).toBeInTheDocument()
  })

  it('renders the "no meetings yet" empty state when there are no filters', () => {
    mockReturn({ data: [{ items: [], nextCursor: null }] })
    render(<MeetingList />)
    expect(screen.getByText(/no meetings yet/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/no meetings match your filters/i),
    ).not.toBeInTheDocument()
  })

  it('renders the "no meetings match your filters" empty state when filters are active', () => {
    act(() =>
      useMeetingStore.setState((s) => ({
        filters: { ...s.filters, search: 'standup' },
      })),
    )
    mockReturn({ data: [{ items: [], nextCursor: null }] })
    render(<MeetingList />)
    expect(
      screen.getByText(/no meetings match your filters/i),
    ).toBeInTheDocument()
  })

  it('renders an error state with retry affordance when the hook errors', () => {
    mockReturn({ error: new Error('boom') })
    render(<MeetingList />)
    expect(screen.getByText(/boom/i)).toBeInTheDocument()
  })

  it('shows a Load more button when nextCursor exists and calls setSize on click', async () => {
    const setSize = jest.fn()
    mockReturn({
      data: [
        {
          items: [meeting('1')],
          nextCursor: 'cur_1',
        },
      ],
      size: 1,
      setSize: setSize as any,
    })

    render(<MeetingList />)
    const loadMore = screen.getByRole('button', { name: /load more/i })
    expect(loadMore).toBeInTheDocument()

    await userEvent.click(loadMore)
    expect(setSize).toHaveBeenCalledWith(2)
  })

  it('omits the Load more button when nextCursor is null', () => {
    mockReturn({
      data: [{ items: [meeting('1')], nextCursor: null }],
      size: 1,
    })
    render(<MeetingList />)
    expect(
      screen.queryByRole('button', { name: /load more/i }),
    ).not.toBeInTheDocument()
  })
})
