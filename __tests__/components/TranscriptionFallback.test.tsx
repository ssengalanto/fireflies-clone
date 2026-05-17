import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TranscriptionFallback } from '@/components/transcript/TranscriptionFallback'
import type { TranscriptionError } from '@/lib/fetchers/transcribe.fetcher'

function renderFallback(error: TranscriptionError) {
  const onRetry = jest.fn()
  const onManual = jest.fn()
  const onReRecord = jest.fn()
  render(
    <TranscriptionFallback
      error={error}
      onRetry={onRetry}
      onManual={onManual}
      onReRecord={onReRecord}
    />,
  )
  return { onRetry, onManual, onReRecord }
}

describe('TranscriptionFallback — variants by error kind', () => {
  it('NETWORK: renders Retry, Enter manually, and Re-record', () => {
    renderFallback({ kind: 'NETWORK', message: 'socket reset' })
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /enter manually/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /re-record/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/could not transcribe/i)).toBeInTheDocument()
  })

  it('PROVIDER: renders all three buttons (Retry shown)', () => {
    renderFallback({ kind: 'PROVIDER', message: 'upstream 500' })
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /enter manually/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /re-record/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/transcription failed/i)).toBeInTheDocument()
  })

  it('TOO_LARGE: hides Retry; shows Enter manually + Re-record', () => {
    renderFallback({ kind: 'TOO_LARGE', message: 'too big' })
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /enter manually/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /re-record/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/recording is too long/i)).toBeInTheDocument()
  })

  it('NO_SPEECH: hides Retry; shows Enter manually + Re-record', () => {
    renderFallback({ kind: 'NO_SPEECH', message: 'silence' })
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /enter manually/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /re-record/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no speech detected/i)).toBeInTheDocument()
  })

  it('renders inside a role="alert" region so screen readers announce it', () => {
    renderFallback({ kind: 'NETWORK', message: 'x' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('TranscriptionFallback — button callbacks', () => {
  it('Retry calls onRetry exactly once', async () => {
    const { onRetry } = renderFallback({ kind: 'NETWORK', message: 'x' })
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('Enter manually calls onManual exactly once', async () => {
    const { onManual } = renderFallback({ kind: 'NETWORK', message: 'x' })
    await userEvent.click(
      screen.getByRole('button', { name: /enter manually/i }),
    )
    expect(onManual).toHaveBeenCalledTimes(1)
  })

  it('Re-record calls onReRecord exactly once', async () => {
    const { onReRecord } = renderFallback({ kind: 'NETWORK', message: 'x' })
    await userEvent.click(screen.getByRole('button', { name: /re-record/i }))
    expect(onReRecord).toHaveBeenCalledTimes(1)
  })
})
