export type NotificationType     = 'achievement' | 'reminder' | 'insight' | 'warning' | 'motivation'
export type NotificationPriority = 'low' | 'medium' | 'high'

export interface NotificationPayload {
  type:      NotificationType
  priority:  NotificationPriority
  title:     string
  message:   string
  data?:     Record<string, unknown>
}
