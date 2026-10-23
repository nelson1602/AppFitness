import { create } from 'zustand';

import {
  bindStoreToSession,
  isSessionCurrent,
  requireSessionSnapshot,
  type SessionSnapshot,
} from '@/features/authentication';
import { isDatabaseUnsupportedOnWebError } from '@/shared/infrastructure/database/web-unsupported';
import { logError } from '@/shared/infrastructure/logging';

import {
  listReadNotificationIds,
  markNotificationsRead,
} from '../infrastructure/notification-read.repository';

export type NotificationsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'web-unavailable';

export interface NotificationsState {
  status: NotificationsStatus;
  /** Ids the signed-in account has read (ADR-P039 D4). */
  readIds: readonly string[];
  load: () => Promise<void>;
  markRead: (ids: readonly string[]) => Promise<void>;
}

const INITIAL = { status: 'idle' as NotificationsStatus, readIds: [] as readonly string[] };

/**
 * Orchestrates read state only; the notifications themselves are derived on
 * screen from data already loaded (`buildNotifications`). Every publish is
 * gated on the account that started the work (ADR-P030 C-1).
 */
export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  ...INITIAL,
  load: async () => {
    let owner: SessionSnapshot | null = null;
    set({ status: 'loading' });
    try {
      owner = requireSessionSnapshot();
      const readIds = await listReadNotificationIds(owner.userId);
      if (!isSessionCurrent(owner)) return;
      set({ readIds, status: 'ready' });
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      if (isDatabaseUnsupportedOnWebError(error)) {
        set({ ...INITIAL, status: 'web-unavailable' });
        return;
      }
      logError('notifications.load', error);
      set({ status: 'error' });
    }
  },
  markRead: async (ids) => {
    const fresh = ids.filter((id) => !get().readIds.includes(id));
    if (fresh.length === 0) return;
    let owner: SessionSnapshot | null = null;
    // Optimistic: the badge clears at once; a failed write is logged and the
    // next load restores the true state.
    set({ readIds: [...get().readIds, ...fresh] });
    try {
      owner = requireSessionSnapshot();
      await markNotificationsRead(owner.userId, fresh);
    } catch (error) {
      if (owner && !isSessionCurrent(owner)) return;
      logError('notifications.markRead', error);
    }
  },
}));

bindStoreToSession(() => useNotificationsStore.setState({ ...INITIAL }));
