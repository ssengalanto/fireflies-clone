import { z } from 'zod'

export const updateTranscriptSchema = z.object({
  transcript: z
    .string()
    .min(1, 'Transcript cannot be empty')
    .max(100_000, 'Transcript is too long'),
})

export type UpdateTranscriptInput = z.infer<typeof updateTranscriptSchema>
