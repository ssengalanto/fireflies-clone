import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DateTimePicker } from '@/components/ui/datetime-picker'

describe('<DateTimePicker />', () => {
  it('renders a trigger button that shows the current value formatted', () => {
    // 2026-05-18T02:00:00.000Z → in the runner's UTC test env this renders
    // as 05/18/2026, 02:00 AM (UTC). We don't assert the full timezone-y
    // string; we just confirm the trigger surfaces date + time, not the raw
    // ISO blob.
    render(
      <DateTimePicker
        value="2026-05-18T02:00:00.000Z"
        onChange={jest.fn()}
      />,
    )
    const trigger = screen.getByRole('button', { name: /05\/18\/2026/i })
    expect(trigger).toBeInTheDocument()
  })

  it('opens the calendar popover when the trigger is clicked', async () => {
    render(
      <DateTimePicker
        value="2026-05-18T02:00:00.000Z"
        onChange={jest.fn()}
      />,
    )
    // Closed initially.
    expect(
      screen.queryByRole('dialog', { name: /date and time picker/i }),
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /05\/18\/2026/i }))

    expect(
      screen.getByRole('dialog', { name: /date and time picker/i }),
    ).toBeInTheDocument()
    // The current month is rendered.
    expect(screen.getByText(/May 2026/i)).toBeInTheDocument()
  })

  it('calls onChange with a new ISO string when the user picks a different day, preserving the time', async () => {
    const onChange = jest.fn()
    render(
      <DateTimePicker
        value="2026-05-18T02:00:00.000Z"
        onChange={onChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /05\/18\/2026/i }))
    // Pick May 20, 2026 — there's only one button labelled exactly that.
    await userEvent.click(
      screen.getByRole('button', { name: /^May 20, 2026$/i }),
    )

    expect(onChange).toHaveBeenCalledTimes(1)
    const emitted = new Date(onChange.mock.calls[0][0] as string)
    expect(emitted.getUTCFullYear()).toBe(2026)
    expect(emitted.getUTCMonth()).toBe(4) // May (0-indexed)
    expect(emitted.getUTCDate()).toBe(20)
    // The time payload (02:00 UTC) is preserved.
    expect(emitted.getUTCHours()).toBe(2)
    expect(emitted.getUTCMinutes()).toBe(0)
  })

  it('flips the meridiem and emits a 12-hour-shifted ISO when AM → PM is toggled', async () => {
    const onChange = jest.fn()
    render(
      <DateTimePicker
        // 14:00 UTC = 14:00 local in the runner (TZ=UTC in jest); 14:00 is
        // 2:00 PM. Use a UTC-anchored value so the test is timezone-agnostic.
        value="2026-05-18T02:00:00.000Z"
        onChange={onChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /05\/18\/2026/i }))

    // The PM toggle button. AM is currently selected.
    await userEvent.click(screen.getByRole('button', { name: /^PM$/i }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const emitted = new Date(onChange.mock.calls[0][0] as string)
    // 02:00 AM (UTC) + 12 h = 14:00 (UTC).
    expect(emitted.getUTCHours()).toBe(14)
    expect(emitted.getUTCMinutes()).toBe(0)
    expect(emitted.getUTCDate()).toBe(18)
  })
})
