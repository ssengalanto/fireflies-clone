export interface TranscriptViewProps {
  transcript: string | null
}

export function TranscriptView({ transcript }: TranscriptViewProps) {
  if (transcript === null || transcript.trim().length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No transcript yet.</p>
    )
  }

  const paragraphs = transcript.split(/\n\n+/)

  return (
    <div className="prose prose-sm max-w-none space-y-3">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap text-sm">
          {p}
        </p>
      ))}
    </div>
  )
}
