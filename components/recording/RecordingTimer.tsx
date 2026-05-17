export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RecordingTimer({ elapsed }: { elapsed: number }) {
  return (
    <span
      className="num text-base font-medium text-fg"
      aria-label="recording elapsed time"
    >
      {formatElapsed(elapsed)}
    </span>
  )
}
