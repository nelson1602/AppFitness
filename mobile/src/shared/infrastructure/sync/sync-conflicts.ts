import { queryAll, run } from '../database';
import type { ConflictResolutionStatus, SyncConflictRow } from '../database/types';
import type { RecordConflictInput } from './types';

/**
 * Local conflict store: server-reported version conflicts wait here so
 * the user can review and resolve them offline. Critical medical fields
 * are NEVER auto-resolved (.ai/04_DATABASE.md) — resolution is an
 * explicit user action pushed on reconnect.
 */

export async function recordConflict(input: RecordConflictInput, nowIso: string): Promise<void> {
  await run(
    `INSERT INTO sync_conflicts
       (id, entity_type, entity_id, local_payload, server_payload,
        base_version, server_version, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [
      input.id,
      input.entityType,
      input.entityId,
      JSON.stringify(input.localPayload),
      JSON.stringify(input.serverPayload),
      input.baseVersion,
      input.serverVersion,
      nowIso,
    ],
  );
}

export async function listPendingConflicts(): Promise<SyncConflictRow[]> {
  return queryAll<SyncConflictRow>(
    `SELECT * FROM sync_conflicts WHERE status = 'PENDING' ORDER BY created_at ASC`,
  );
}

export async function resolveConflict(
  id: string,
  resolution: Exclude<ConflictResolutionStatus, 'PENDING'>,
  nowIso: string,
): Promise<void> {
  await run(`UPDATE sync_conflicts SET status = ?, resolved_at = ? WHERE id = ?`, [
    resolution,
    nowIso,
    id,
  ]);
}
