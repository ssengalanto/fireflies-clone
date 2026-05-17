import { z } from 'zod'

export const transcribeRequestSchema = z.object({
  meetingId: z.string().min(1, 'meetingId is required'),
  audio: z.instanceof(File, { message: 'audio must be a File' }),
})

export const transcribeResponseSchema = z.object({
  transcript: z.string().min(1, 'transcript must be non-empty'),
  durationSeconds: z.number().nonnegative(),
})

export type TranscribeRequestInput = z.infer<typeof transcribeRequestSchema>
export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>
