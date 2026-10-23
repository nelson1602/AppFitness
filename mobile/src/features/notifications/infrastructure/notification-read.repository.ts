import { inTransaction, queryAll, queryFirst, run } from '@/shared/infrastructure/database';
import { generateUuid } from '@/shared/infrastructure/ids';

/**
 * Read state of in-app notifications (ADR-P039 D4), in the existing
 * `notifications` table from migration 001. One row per notification the user
 * has read: `type` holds the derived notification id, `is_read` is 1. Rows are
 * local only — nothing enqueues them for sync, and they carry no content.
 */
export async function listReadNotificationIds(userId: string): Promise<string[]> {
  const rows = await queryAll<{ type: string }>(
    `SELECT type FROM notifications
     WHERE user_id = ? AND is_read = 1 AND deleted_at IS NULL`,
    [userId],
  );
  return rows.map((row) => row.type);
}

/** Records ids as read. Idempotent: an id already read is not written twice. */
export async function markNotificationsRead(userId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  await inTransaction(async (tx) => {
    for (const id of ids) {
      const existing = await queryFirst<{ id: string }>(
        `SELECT id FROM notifications WHERE user_id = ? AND type = ? AND deleted_at IS NULL`,
        [userId, id],
        tx,
      );
      if (existing) continue;
      await run(
        `INSERT INTO notifications
           (id, user_id, created_at, updated_at, sync_status, type, title, message, data, is_read)
         VALUES (?, ?, ?, ?, 'synced', ?, '', '', '{}', 1)`,
        [generateUuid(), userId, now, now, id],
        tx,
      );
    }
  });
}
