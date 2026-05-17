import { render, screen } from '@testing-library/react'

import { TranscriptView } from '@/components/transcript/TranscriptView'

describe('<TranscriptView />', () => {
  it('renders each paragraph (split on \\n\\n)', () => {
    render(<TranscriptView transcript={'Alice: hi.\n\nBob: hello.'} />)
    expect(screen.getByText('Alice: hi.')).toBeInTheDocument()
    expect(screen.getByText('Bob: hello.')).toBeInTheDocument()
  })

  it('renders a placeholder when transcript is null', () => {
    render(<TranscriptView transcript={null} />)
    expect(screen.getByText(/no transcript yet/i)).toBeInTheDocument()
  })
})
