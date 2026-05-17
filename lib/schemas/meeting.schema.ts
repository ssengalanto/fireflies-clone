// Foundational stub. T028 (US1) overlays the zod schemas on this file and
// the manually-written interfaces become `z.infer<typeof <schema>>` aliases
// with the same shape. The server-side meeting store imports `Meeting` and
// `MeetingStatus` from here in the meantime.

export type MeetingStatus = 'draft' | 'recorded' | 'summarized'

export interface Meeting {
  id: string
  title: string
  participants: string[]
  date: string
  durationSeconds: number
  status: MeetingStatus
  transcript: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMeetingInput {
  title: string
  participants: string[]
  date: string
}
