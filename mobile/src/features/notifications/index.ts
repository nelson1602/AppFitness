export {
  buildNotifications,
  NOTIFICATION_RULE_VERSION,
  unreadOf,
  type AppNotification,
  type NotificationInputs,
  type NotificationKind,
  type NotificationTarget,
} from './domain/notifications';
export { useNotificationsStore, type NotificationsStatus } from './application/notifications.store';
