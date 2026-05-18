import { z } from 'zod'

export const meetingStatusSchema = z.enum(['draft', 'recorded', 'summarized'])
export type MeetingStatus = z.infer<typeof meetingStatusSchema>

export const meetingSchema = z.object({
  id: z.string().min(1),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(120, 'Title is too long'),
  participants: z
    .array(z.string().email('Invalid participant email'))
    .min(1, 'At least one participant is required'),
  date: z.string().datetime({ message: 'Date must be a valid ISO 8601 string' }),
  durationSeconds: z.number().int().nonnegative(),
  status: meetingStatusSchema,
  transcript: z.string().max(100_000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Meeting = z.infer<typeof meetingSchema>

// Compared at calendar-day granularity, not the full datetime — a meeting
// dated earlier *today* is fine (capturing one that just happened); only
// dates before today's local 00:00 are rejected.
function isOnOrAfterToday(iso: string): boolean {
  const day = new Date(iso)
  if (Number.isNaN(day.getTime())) return false
  day.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return day.getTime() >= today.getTime()
}

export const createMeetingSchema = meetingSchema
  .pick({
    title: true,
    participants: true,
    date: true,
  })
  .refine((data) => isOnOrAfterToday(data.date), {
    message: 'Date cannot be in the past',
    path: ['date'],
  })
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>

export const actionItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  owner: z.string().nullable(),
  dueDate: z.string().datetime().nullable(),
})
export type ActionItem = z.infer<typeof actionItemSchema>
