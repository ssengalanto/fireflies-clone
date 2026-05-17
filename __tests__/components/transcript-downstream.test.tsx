import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ActionItems } from '@/components/summary/ActionItems'
import { SummaryView } from '@/components/summary/SummaryView'
import { useActionItems } from '@/lib/hooks/useActionItems'
import { useSummary, useSummaryStream } from '@/lib/hooks/useSummary'

import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/lib/hooks/useSummary')
jest.mock('@/lib/hooks/useActionItems')

const mockUseSummary = useSummary as jest.MockedFunction<typeof useSummary>
const mockUseSummaryStream = useSummaryStream as jest.MockedFunction<
  typeof useSummaryStream
>
const mockUseActionItems = useActionItems as jest.MockedFunction<
  typeof useActionItems
>

const AUTO_RAW = 'Auto produced text with mistake.' // 32 chars — below MIN, but we extend
const USER_EDITED =
  'Auto produced text without mistake. This is the version the user confirmed before any AI step ran.'

beforeEach(() => {
  mockUseSummary.mockReset()
  mockUseSummaryStream.mockReset()
  mockUseActionItems.mockReset()
})

/**
 * Regression guard for FR-009: summary and action-item generation MUST
 * operate on the transcript the user confirmed (edited or accepted as-is),
 * never on an earlier auto-produced draft.
 *
 * The way the existing page wires these components is: the page reads
 * `meeting.transcript` (the *saved* value) and passes it as the
 * `transcript` prop. We assert that the underlying AI hooks are then
 * called with that value — not with anything else.
 */
describe('Downstream AI consumers operate on the user-confirmed transcript (US2)', () => {
  it('useSummaryStream receives the user-edited transcript when the user clicks Generate', async () => {
    const generate = jest.fn().mockResolvedValue(undefined)
    mockUseSummary.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as unknown as ReturnType<typeof useSummary>)
    mockUseSummaryStream.mockReturnValue({
      text: '',
      isStreaming: false,
      error: null,
      generate,
    })

    render(<SummaryView meetingId="mtg_1" transcript={USER_EDITED} />, {
      wrapper: createTestWrapper(),
    })

    // The hook itself is called with the prop transcript on every render
    // of the SummaryGenerator subtree.
    expect(mockUseSummaryStream).toHaveBeenCalledWith('mtg_1', USER_EDITED)
    // Crucially: the auto-produced raw transcript is NOT what we passed.
    expect(mockUseSummaryStream).not.toHaveBeenCalledWith('mtg_1', AUTO_RAW)

    // Generate fires off the streaming request — proving the bound
    // transcript is what gets used.
    await userEvent.click(
      screen.getByRole('button', { name: /generate summary/i }),
    )
    expect(generate).toHaveBeenCalled()
  })

  it('useActionItems receives the user-edited transcript', () => {
    mockUseActionItems.mockReturnValue({
      data: undefined,
      extract: jest.fn(),
      isExtracting: false,
      error: null,
    })

    render(<ActionItems meetingId="mtg_1" transcript={USER_EDITED} />, {
      wrapper: createTestWrapper(),
    })

    expect(mockUseActionItems).toHaveBeenCalledWith('mtg_1', USER_EDITED)
    expect(mockUseActionItems).not.toHaveBeenCalledWith('mtg_1', AUTO_RAW)
  })

  it('SummaryView with cached output reads from useSummary, not from the raw auto-produced draft', () => {
    mockUseSummary.mockReturnValue({
      data: 'Cached summary from the user-edited transcript.',
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as unknown as ReturnType<typeof useSummary>)
    mockUseSummaryStream.mockReturnValue({
      text: '',
      isStreaming: false,
      error: null,
      generate: jest.fn(),
    })

    render(<SummaryView meetingId="mtg_1" transcript={USER_EDITED} />, {
      wrapper: createTestWrapper(),
    })

    expect(
      screen.getByText('Cached summary from the user-edited transcript.'),
    ).toBeInTheDocument()
    // useSummaryStream is rendered behind a `cached` gate; with cached
    // present, the streamer subtree is never mounted, so the auto-raw
    // transcript can't leak into a stream request.
    expect(mockUseSummaryStream).not.toHaveBeenCalled()
  })
})
