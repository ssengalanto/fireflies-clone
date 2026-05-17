import { render, screen } from '@testing-library/react'

import { MeetingCard } from '@/components/meetings/MeetingCard'

const baseMeeting = {
  id: 'mtg_1',
  title: 'Roadmap review',
  participants: ['alice@example.com', 'bob@example.com'],
  date: '2026-05-17T10:00:00.000Z',
  durationSeconds: 332, // 5m 32s
  status: 'recorded' as const,
  transcript: 'hello',
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
}

describe('<MeetingCard />', () => {
  it('renders the meeting title as a heading', () => {
    render(<MeetingCard meeting={baseMeeting} />)
    expect(
      screen.getByRole('heading', { name: /roadmap review/i }),
    ).toBeInTheDocument()
  })

  it('renders the formatted duration "5m 32s"', () => {
    render(<MeetingCard meeting={baseMeeting} />)
    expect(screen.getByText('5m 32s')).toBeInTheDocument()
  })

  it('renders 0s duration as "0s"', () => {
    render(<MeetingCard meeting={{ ...baseMeeting, durationSeconds: 0 }} />)
    expect(screen.getByText('0s')).toBeInTheDocument()
  })

  it('renders the date in a human-readable form', () => {
    render(<MeetingCard meeting={baseMeeting} />)
    // The exact formatting depends on the locale — assert the year + month
    // are present in some form.
    const text = screen.getByText(/2026/)
    expect(text).toBeInTheDocument()
  })

  it('flags an optimistic temp- meeting with a "Pending" badge', () => {
    render(
      <MeetingCard
        meeting={{ ...baseMeeting, id: 'temp-abc', status: 'draft' }}
      />,
    )
    expect(screen.getByText(/pending/i)).toBeInTheDocument()
  })
})
