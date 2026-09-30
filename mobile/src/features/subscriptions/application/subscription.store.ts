import { createStore, type StoreApi } from 'zustand/vanilla';

import type {
  PurchaseAccessSnapshot,
  PurchaseOutcome,
  SubscriptionOffer,
  SubscriptionOfferHandle,
} from '../domain/purchases.port';
import {
  SubscriptionProviderError,
  SubscriptionSessionChangedError,
  SubscriptionUnavailableError,
  type SubscriptionSessionSnapshot,
} from './subscription-purchases';

/** Where purchasing stands on this build (ADR-P019 Web boundary included). */
export type SubscriptionAvailability = 'web' | 'unconfigured' | 'available';

/** Which store's account and settings the disclosures must name. */
export type SubscriptionStoreKind = 'apple' | 'google';

export interface SubscriptionGateway {
  availability(): SubscriptionAvailability;
  storeKind(): SubscriptionStoreKind;
  loadAccess(): Promise<PurchaseAccessSnapshot>;
  loadOffer(): Promise<SubscriptionOffer | null>;
  purchase(handle: SubscriptionOfferHandle): Promise<PurchaseOutcome>;
  restore(): Promise<PurchaseAccessSnapshot>;
  manage(): Promise<void>;
}

export interface SubscriptionStoreSessions {
  getSessionSnapshot(): SubscriptionSessionSnapshot | null;
  isSessionCurrent(snapshot: SubscriptionSessionSnapshot): boolean;
}

export type SubscriptionReporter = (scope: string, error: unknown) => void;

/**
 * Surface status. `ready` with `offer === null` and an inactive `access` is the
 * "no offer returned" condition; it is never filled with a fabricated offer.
 */
export type SubscriptionStatus =
  'idle' | 'loading' | 'web-unavailable' | 'unavailable' | 'ready' | 'offline' | 'error';

export type SubscriptionOperation = 'purchasing' | 'restoring' | 'managing' | null;

/** The last completed operation, for its confirmation. Not a canonical state. */
export type SubscriptionNotice = 'purchased' | 'restored' | 'nothingToRestore' | null;

/**
 * Why an operation or load did not complete. A discriminant only: the screen
 * maps it to catalogue copy, so no provider text can ever be rendered.
 * Cancellation is deliberately absent — a user who backs out of the store
 * sheet made a choice, not an error.
 */
export type SubscriptionIssue =
  | 'network'
  | 'purchaseFailed'
  | 'purchaseNotAllowed'
  | 'restoreFailed'
  | 'manageFailed'
  | 'sessionChanged'
  | null;

export interface SubscriptionState {
  status: SubscriptionStatus;
  storeKind: SubscriptionStoreKind;
  access: PurchaseAccessSnapshot | null;
  offer: SubscriptionOffer | null;
  operation: SubscriptionOperation;
  notice: SubscriptionNotice;
  issue: SubscriptionIssue;
  /**
   * A purchase the store reported as pending (or completed without an active
   * entitlement) in this session. While it stands the surface is non-active and
   * no second purchase can start; restore stays available. Only a confirmed
   * active entitlement or an account reset clears it. The SDK exposes no
   * pending state to re-read, so nothing is persisted or fabricated.
   */
  purchasePending: boolean;
  load: () => Promise<void>;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  manage: () => Promise<void>;
  reset: () => void;
}

type Data = Omit<SubscriptionState, 'load' | 'purchase' | 'restore' | 'manage' | 'reset'>;

function initialData(storeKind: SubscriptionStoreKind): Data {
  return {
    status: 'idle',
    storeKind,
    access: null,
    offer: null,
    operation: null,
    notice: null,
    issue: null,
    purchasePending: false,
  };
}

function reasonOf(error: unknown): 'network' | 'notAllowed' | 'unknown' {
  return error instanceof SubscriptionProviderError ? error.reason : 'unknown';
}

/**
 * Subscription orchestration (ADR-P034 **S-3**).
 *
 * Every publication is gated on the session captured when the action began
 * (S-2 generation protection): a result belonging to an earlier session never
 * updates the current account. When the *same* account is still signed in but
 * its session generation moved (for example a token refresh), the result is
 * still discarded and the surface asks for a neutral retry. When the account
 * changed, nothing is published at all — the session binding has already reset
 * this store for the new owner.
 */
export function createSubscriptionStore(
  gateway: SubscriptionGateway,
  sessions: SubscriptionStoreSessions,
  report: SubscriptionReporter,
): StoreApi<SubscriptionState> {
  return createStore<SubscriptionState>((set, get) => {
    let loadSequence = 0;

    /** Publishes only for the session that started the work. */
    const publish = (owner: SubscriptionSessionSnapshot, patch: Partial<Data>): boolean => {
      if (sessions.isSessionCurrent(owner)) {
        set(patch);
        return true;
      }
      if (sessions.getSessionSnapshot()?.userId === owner.userId) {
        set(
          get().status === 'loading'
            ? { status: 'error', operation: null, issue: 'sessionChanged' }
            : { operation: null, issue: 'sessionChanged' },
        );
      }
      return false;
    };

    const startOperation = (operation: Exclude<SubscriptionOperation, null>) => {
      const state = get();
      if (state.status !== 'ready' || state.operation !== null) return null;
      const owner = sessions.getSessionSnapshot();
      if (!owner) return null;
      set({ operation, notice: null, issue: null });
      return owner;
    };

    const failOperation = (
      owner: SubscriptionSessionSnapshot,
      error: unknown,
      scope: string,
      fallback: Exclude<SubscriptionIssue, null>,
    ) => {
      if (error instanceof SubscriptionSessionChangedError) {
        publish(owner, { operation: null, issue: 'sessionChanged' });
        return;
      }
      if (error instanceof SubscriptionUnavailableError) {
        publish(owner, { ...initialData(get().storeKind), status: 'unavailable' });
        return;
      }
      const reason = reasonOf(error);
      if (reason === 'unknown') report(scope, error);
      const issue =
        reason === 'network'
          ? 'network'
          : reason === 'notAllowed' && fallback === 'purchaseFailed'
            ? 'purchaseNotAllowed'
            : fallback;
      publish(owner, { operation: null, issue });
    };

    return {
      ...initialData(gateway.storeKind()),

      load: async () => {
        const availability = gateway.availability();
        if (availability === 'web') {
          set({ ...initialData(get().storeKind), status: 'web-unavailable' });
          return;
        }
        if (availability === 'unconfigured') {
          set({ ...initialData(get().storeKind), status: 'unavailable' });
          return;
        }
        const owner = sessions.getSessionSnapshot();
        if (!owner) return;

        loadSequence += 1;
        const sequence = loadSequence;
        const current = () => sequence === loadSequence;
        set({ status: 'loading', operation: null, notice: null, issue: null });

        try {
          const access = await gateway.loadAccess();
          if (!current()) return;
          if (access.isActive) {
            publish(owner, { status: 'ready', access, offer: null, purchasePending: false });
            return;
          }
          const offer = await gateway.loadOffer();
          if (!current()) return;
          publish(owner, { status: 'ready', access, offer });
        } catch (error) {
          if (!current()) return;
          if (error instanceof SubscriptionSessionChangedError) {
            publish(owner, { status: 'error', issue: 'sessionChanged' });
            return;
          }
          if (error instanceof SubscriptionUnavailableError) {
            publish(owner, { ...initialData(get().storeKind), status: 'unavailable' });
            return;
          }
          if (reasonOf(error) === 'network') {
            publish(owner, { status: 'offline', access: null, offer: null });
            return;
          }
          report('subscriptions.load', error);
          publish(owner, { status: 'error', access: null, offer: null, issue: null });
        }
      },

      purchase: async () => {
        const offer = get().offer;
        // A pending purchase must never be followed by a second one.
        if (!offer || get().purchasePending) return;
        const owner = startOperation('purchasing');
        if (!owner) return;
        try {
          const outcome = await gateway.purchase(offer.handle);
          if (outcome.kind === 'cancelled') {
            publish(owner, { operation: null });
          } else if (outcome.kind === 'completed' && outcome.access.isActive) {
            publish(owner, {
              operation: null,
              access: outcome.access,
              offer: null,
              notice: 'purchased',
              purchasePending: false,
            });
          } else {
            // A pending purchase — or a completed one whose entitlement the
            // provider does not yet report — is never presented as active.
            publish(owner, { operation: null, purchasePending: true });
          }
        } catch (error) {
          failOperation(owner, error, 'subscriptions.purchase', 'purchaseFailed');
        }
      },

      restore: async () => {
        const owner = startOperation('restoring');
        if (!owner) return;
        try {
          const access = await gateway.restore();
          publish(
            owner,
            access.isActive
              ? { operation: null, access, offer: null, notice: 'restored', purchasePending: false }
              : { operation: null, notice: 'nothingToRestore' },
          );
        } catch (error) {
          failOperation(owner, error, 'subscriptions.restore', 'restoreFailed');
        }
      },

      manage: async () => {
        const owner = startOperation('managing');
        if (!owner) return;
        try {
          await gateway.manage();
          publish(owner, { operation: null });
        } catch (error) {
          failOperation(owner, error, 'subscriptions.manage', 'manageFailed');
        }
      },

      reset: () => {
        loadSequence += 1;
        set(initialData(get().storeKind));
      },
    };
  });
}
