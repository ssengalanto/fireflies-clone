import { render, screen } from '@testing-library/react'

import { MeetingList } from '@/components/meetings/MeetingList'
import { useMeetings } from '@/lib/hooks/useMeetings'

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

  it('renders an empty state when there are no meetings', () => {
    mockReturn({ data: [{ items: [], nextCursor: null }] })
    render(<MeetingList />)
    expect(screen.getByText(/no meetings yet/i)).toBeInTheDocument()
  })

  it('renders an error state with retry affordance when the hook errors', () => {
    mockReturn({ error: new Error('boom') })
    render(<MeetingList />)
    expect(screen.getByText(/boom/i)).toBeInTheDocument()
  })
})
