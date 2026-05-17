import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MeetingFilters } from '@/components/meetings/MeetingFilters'
import { useMeetingStore } from '@/lib/store/meetingStore'

import { resetStores } from '../../utils/stores'

beforeEach(() => {
  resetStores()
})

describe('<MeetingFilters />', () => {
  it('renders the search input pre-populated from meetingStore.filters.search', () => {
    act(() =>
      useMeetingStore.setState((s) => ({
        filters: { ...s.filters, search: 'standup' },
      })),
    )
    render(<MeetingFilters />)
    expect(screen.getByRole('searchbox', { name: /search/i })).toHaveValue(
      'standup',
    )
  })

  it('calls setFilter({ search }) on every keystroke', async () => {
    render(<MeetingFilters />)
    await userEvent.type(
      screen.getByRole('searchbox', { name: /search/i }),
      'roadmap',
    )
    expect(useMeetingStore.getState().filters.search).toBe('roadmap')
  })

  it('preserves status when search is typed (setFilter is a merge, not a replace)', async () => {
    act(() =>
      useMeetingStore.setState((s) => ({
        filters: { ...s.filters, status: 'recorded' },
      })),
    )
    render(<MeetingFilters />)
    await userEvent.type(
      screen.getByRole('searchbox', { name: /search/i }),
      'q',
    )
    expect(useMeetingStore.getState().filters).toEqual({
      search: 'q',
      status: 'recorded',
    })
  })

  it('renders the status select with the current value', () => {
    act(() =>
      useMeetingStore.setState((s) => ({
        filters: { ...s.filters, status: 'summarized' },
      })),
    )
    render(<MeetingFilters />)
    // The shadcn/Radix Select trigger surfaces the value via its accessible
    // name; the visible label of the trigger is the current option's text.
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveTextContent(
      /summarized/i,
    )
  })

  it('updates the status filter when the select trigger is operated', async () => {
    render(<MeetingFilters />)
    const trigger = screen.getByRole('combobox', { name: /status/i })
    await userEvent.click(trigger)
    // Radix renders options into a portal once the trigger is opened. The
    // visible "Recorded" option is the one we want.
    const option = await screen.findByRole('option', { name: /^recorded$/i })
    await userEvent.click(option)
    expect(useMeetingStore.getState().filters.status).toBe('recorded')
  })
})
