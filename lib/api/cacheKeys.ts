export type MeetingStatusFilter = 'all' | 'recorded' | 'summarized'

export interface MeetingFilters {
  search: string
  status: MeetingStatusFilter
}

export const meetingKeys = {
  all: ['meeting'] as const,
  lists: () => [...meetingKeys.all, 'list'] as const,
  list: (filters: MeetingFilters) => [...meetingKeys.lists(), filters] as const,
  detail: (id: string) => [...meetingKeys.all, 'detail', id] as const,
  summary: (id: string) => [...meetingKeys.detail(id), 'summary'] as const,
  actionItems: (id: string) =>
    [...meetingKeys.detail(id), 'action-items'] as const,
}
