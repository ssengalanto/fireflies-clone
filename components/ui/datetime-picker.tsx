'use client'

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export interface DateTimePickerProps {
  value: string
  onChange: (next: string) => void
  id?: string
  className?: string
}

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function parseValue(value: string): Date {
  if (!value) return new Date()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function formatTrigger(value: string): string {
  if (!value) return 'Select date and time'
  const d = parseValue(value)
  // Two-digit MM/DD/YYYY + HH:MM 12-hour. Stable across locales because we
  // assemble it ourselves rather than rely on Intl.DateTimeFormat's
  // locale-specific separators.
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const year = d.getFullYear()
  const h24 = d.getHours()
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  const mer = h24 >= 12 ? 'PM' : 'AM'
  return `${m}/${day}/${year}, ${pad(h12)}:${pad(d.getMinutes())} ${mer}`
}

interface DayCell {
  y: number
  m: number
  d: number
  inMonth: boolean
}

function buildMonthGrid(year: number, month: number): DayCell[] {
  const firstWeekday = new Date(year, month, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells: DayCell[] = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({
      y: month === 0 ? year - 1 : year,
      m: month === 0 ? 11 : month - 1,
      d: daysInPrev - firstWeekday + 1 + i,
      inMonth: false,
    })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ y: year, m: month, d, inMonth: true })
  }
  let tail = 1
  while (cells.length < 42) {
    cells.push({
      y: month === 11 ? year + 1 : year,
      m: month === 11 ? 0 : month + 1,
      d: tail++,
      inMonth: false,
    })
  }
  return cells
}

export function DateTimePicker({
  value,
  onChange,
  id,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const current = parseValue(value)
  const [view, setView] = useState<{ year: number; month: number }>({
    year: current.getFullYear(),
    month: current.getMonth(),
  })

  // Re-sync the visible month when the popover opens — if the user advanced
  // months without picking, we don't want them stranded next time.
  useEffect(() => {
    if (open) {
      const d = parseValue(value)
      setView({ year: d.getFullYear(), month: d.getMonth() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cells = useMemo(
    () => buildMonthGrid(view.year, view.month),
    [view.year, view.month],
  )

  const todayLocal = useMemo(() => new Date(), [])

  function emitDay(c: DayCell): void {
    const next = new Date(current)
    next.setFullYear(c.y, c.m, c.d)
    onChange(next.toISOString())
  }

  function shiftMonth(delta: number): void {
    setView(({ year, month }) => {
      const m = month + delta
      if (m < 0) return { year: year - 1, month: 11 }
      if (m > 11) return { year: year + 1, month: 0 }
      return { year, month: m }
    })
  }

  function goToToday(): void {
    const now = new Date()
    const next = new Date(current)
    next.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
    onChange(next.toISOString())
    setView({ year: now.getFullYear(), month: now.getMonth() })
  }

  const hour24 = current.getHours()
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  const minute = current.getMinutes()
  const isPM = hour24 >= 12

  function setHour12(h12: number): void {
    if (h12 < 1 || h12 > 12) return
    let h24 = h12
    if (isPM && h12 !== 12) h24 = h12 + 12
    else if (!isPM && h12 === 12) h24 = 0
    const next = new Date(current)
    next.setHours(h24, minute, 0, 0)
    onChange(next.toISOString())
  }

  function setMinuteValue(m: number): void {
    if (m < 0 || m > 59) return
    const next = new Date(current)
    next.setMinutes(m, 0, 0)
    onChange(next.toISOString())
  }

  function setMeridiem(pm: boolean): void {
    if (pm === isPM) return
    let h24 = hour24
    if (pm && hour24 < 12) h24 = hour24 + 12
    if (!pm && hour24 >= 12) h24 = hour24 - 12
    const next = new Date(current)
    next.setHours(h24, minute, 0, 0)
    onChange(next.toISOString())
  }

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="num flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface-1 px-3 text-sm text-fg transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
      >
        <span>{formatTrigger(value)}</span>
        <CalendarIcon
          className="h-3.5 w-3.5 text-fg-muted"
          strokeWidth={1.75}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Date and time picker"
          className="absolute left-0 top-full z-50 mt-1.5 w-[19rem] rounded-md border border-line bg-card p-3.5 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <p className="eyebrow num">
              {MONTH_NAMES[view.month]} {view.year}
            </p>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="eyebrow px-1.5 transition-colors hover:text-accent"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="hairline my-2.5" />

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {DOW_LABELS.map((d, i) => (
              <span
                key={i}
                className="py-1 text-[10px] uppercase tracking-wider text-fg-muted"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c, i) => {
              const isSelected =
                value !== '' &&
                c.y === current.getFullYear() &&
                c.m === current.getMonth() &&
                c.d === current.getDate()
              const isToday =
                c.y === todayLocal.getFullYear() &&
                c.m === todayLocal.getMonth() &&
                c.d === todayLocal.getDate()
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => emitDay(c)}
                  aria-label={`${MONTH_NAMES[c.m]} ${c.d}, ${c.y}`}
                  aria-pressed={isSelected}
                  className={cn(
                    'num h-7 rounded text-xs transition-colors',
                    isSelected
                      ? 'bg-[hsl(var(--accent-hsl))] text-[hsl(var(--accent-fg))]'
                      : c.inMonth
                        ? 'text-fg hover:bg-surface-2'
                        : 'text-fg-muted hover:bg-surface-2',
                    isToday && !isSelected && 'ring-1 ring-inset ring-line-strong',
                  )}
                >
                  {c.d}
                </button>
              )
            })}
          </div>

          <div className="hairline mt-3" />

          <div className="mt-3 flex items-center justify-between">
            <span className="eyebrow">Time</span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                aria-label="Hour"
                value={pad(hour12)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  if (!Number.isNaN(n)) setHour12(n)
                }}
                className="num h-7 w-9 rounded border border-line bg-surface-1 text-center text-xs text-fg focus:border-accent focus:outline-none"
              />
              <span className="num text-fg-muted">:</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                aria-label="Minute"
                value={pad(minute)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  if (!Number.isNaN(n)) setMinuteValue(n)
                }}
                className="num h-7 w-9 rounded border border-line bg-surface-1 text-center text-xs text-fg focus:border-accent focus:outline-none"
              />
              <div
                className="ml-1.5 flex overflow-hidden rounded border border-line"
                role="group"
                aria-label="Meridiem"
              >
                <button
                  type="button"
                  aria-pressed={!isPM}
                  onClick={() => setMeridiem(false)}
                  className={cn(
                    'num h-7 px-2 text-xs transition-colors',
                    !isPM
                      ? 'bg-[hsl(var(--accent-hsl))] text-[hsl(var(--accent-fg))]'
                      : 'bg-surface-1 text-fg-3 hover:text-fg',
                  )}
                >
                  AM
                </button>
                <button
                  type="button"
                  aria-pressed={isPM}
                  onClick={() => setMeridiem(true)}
                  className={cn(
                    'num h-7 px-2 text-xs transition-colors',
                    isPM
                      ? 'bg-[hsl(var(--accent-hsl))] text-[hsl(var(--accent-fg))]'
                      : 'bg-surface-1 text-fg-3 hover:text-fg',
                  )}
                >
                  PM
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
