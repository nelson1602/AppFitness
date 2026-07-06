import { run } from '../../../shared/infrastructure/database';
import type { AuthUser } from '../domain/session.types';

/**
 * Mirrors the authenticated account into `local_user` — the row every
 * synced table's user_id FK references. Must run whenever a session is
 * established (sign-in, sign-up, restore); without it the first
 * local-first write fails on the FK constraint.
 */
export async function ensureLocalUser(
  user: AuthUser,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await run(
    `INSERT INTO local_user (id, email, username, role, phone, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email      = excluded.email,
       username   = excluded.username,
       role       = excluded.role,
       phone      = excluded.phone,
       avatar_url = excluded.avatar_url,
       updated_at = excluded.updated_at`,
    [user.id, user.email, user.username, user.role, user.phone, user.avatarUrl, nowIso, nowIso],
  );
}
