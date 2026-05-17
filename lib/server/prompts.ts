// The model is pinned to a single exported constant so migrations land in
// one place. To A/B against `claude-sonnet-4-6` later, change this line and
// nothing else.
export const MODEL = 'claude-opus-4-7' as const

export function buildSummaryPrompt(): string {
  return [
    'You are an expert meeting note-taker.',
    'Produce a concise prose summary of the following meeting transcript.',
    'Focus on decisions made, action items implied, and the key topics discussed.',
    'Use plain text — no headers, bullet points, or markdown formatting.',
    'Keep the summary under 300 words.',
  ].join(' ')
}

// US3 (T089) fills this in with the JSON-output instructions. A non-empty
// placeholder lets the route handler import the symbol today.
export function buildActionItemsPrompt(): string {
  return 'You extract structured action items from meeting transcripts. (Full prompt lands in US3.)'
}
