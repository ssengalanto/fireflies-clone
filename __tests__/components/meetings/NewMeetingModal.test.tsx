import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { NewMeetingModal } from '@/components/meetings/NewMeetingModal'
import { useCreateMeeting } from '@/lib/hooks/useCreateMeeting'
import { useUIStore } from '@/lib/store/uiStore'

import { resetStores } from '../../utils/stores'
import { createTestWrapper } from '../../utils/wrapper'

// Mock at the network boundary — `useCreateMeetingForm` + `useFieldArray`
// run for real. Mocking the form hook itself would short-circuit RHF's
// internal _getFieldArray plumbing and crash the field-array setup.
jest.mock('@/lib/hooks/useCreateMeeting')
const mockUseCreate = useCreateMeeting as jest.MockedFunction<
  typeof useCreateMeeting
>

beforeEach(() => {
  resetStores()
  mockUseCreate.mockReset()
  mockUseCreate.mockReturnValue({ create: jest.fn(), isCreating: false })
})

const wrapper = createTestWrapper()

describe('<NewMeetingModal />', () => {
  it('renders nothing when activeModal is not "new-meeting"', () => {
    useUIStore.setState({ activeModal: null })
    render(<NewMeetingModal />, { wrapper })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog when activeModal === "new-meeting"', () => {
    useUIStore.setState({ activeModal: 'new-meeting' })
    render(<NewMeetingModal />, { wrapper })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /new meeting/i }),
    ).toBeInTheDocument()
  })

  it('disables the submit button while isCreating', () => {
    mockUseCreate.mockReturnValue({ create: jest.fn(), isCreating: true })
    useUIStore.setState({ activeModal: 'new-meeting' })
    render(<NewMeetingModal />, { wrapper })
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
  })

  it('closes the modal when the user clicks the Cancel button', async () => {
    useUIStore.setState({ activeModal: 'new-meeting' })
    render(<NewMeetingModal />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(useUIStore.getState().activeModal).toBeNull()
  })
})
