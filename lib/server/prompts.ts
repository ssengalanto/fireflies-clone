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

export function buildActionItemsPrompt(): string {
  return [
    'You extract structured action items from a meeting transcript.',
    'Return ONLY a JSON array of objects with this exact shape:',
    '[{ "text": string, "owner": string | null, "dueDate": string | null }].',
    '`text` is a single concrete follow-up sentence.',
    '`owner` is the email or display name of the responsible person, or null if not identified.',
    '`dueDate` is an ISO 8601 datetime if the transcript states a deadline, or null otherwise.',
    'Do not wrap the JSON in markdown fences. Do not add prose around the array.',
    'If the transcript has no clear action items, return [].',
  ].join(' ')
}
