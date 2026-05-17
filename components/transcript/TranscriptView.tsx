export interface TranscriptViewProps {
  transcript: string | null
}

export function TranscriptView({ transcript }: TranscriptViewProps) {
  if (transcript === null || transcript.trim().length === 0) {
    return <p className="text-sm text-fg-muted">No transcript yet.</p>
  }

  const paragraphs = transcript.split(/\n\n+/)

  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-fg-2"
        >
          {p}
        </p>
      ))}
    </div>
  )
}
