import { z } from 'zod'

// The two AI operations share most of their validation surface — both
// require a transcript long enough to be worth a generation, both target a
// specific meeting, and both fail the same way. A discriminated union keeps
// the type-narrowing tidy in the route handler.
const baseRequest = z.object({
  meetingId: z.string().min(1, 'meetingId is required'),
  transcript: z
    .string()
    .min(50, 'Transcript too short')
    .max(100_000, 'Transcript is too long'),
})

export const summaryRequestSchema = baseRequest.extend({
  type: z.literal('summary'),
})

export const actionItemsRequestSchema = baseRequest.extend({
  type: z.literal('action-items'),
})

export const claudeRequestSchema = z.discriminatedUnion('type', [
  summaryRequestSchema,
  actionItemsRequestSchema,
])

export type ClaudeRequest = z.infer<typeof claudeRequestSchema>
export type SummaryRequest = z.infer<typeof summaryRequestSchema>
export type ActionItemsRequest = z.infer<typeof actionItemsRequestSchema>
