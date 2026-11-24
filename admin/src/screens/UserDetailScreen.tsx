import { useState } from 'react';
import { errorMessage } from '../api/client';
import { usersApi } from '../api/endpoints';
import type { UserAction } from '../api/endpoints';
import type { Me, Permission, UserDetail } from '../api/types';
import { Banner, ErrorText, Loading } from '../components/Banner';
import type { BannerMessage } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDateTime, formatNumber } from '../format';
import { useResource } from '../hooks/useResource';
import { es } from '../i18n/es';
import { can } from '../permissions';
import { href, paths } from '../router';

type ActionCopy = (typeof es.userDetail.actions)[keyof Omit<
  typeof es.userDetail.actions,
  'delete'
>];

interface ActionDef {
  action: UserAction;
  permission: Permission;
  copy: ActionCopy;
  destructive?: boolean;
  visible: (user: UserDetail) => boolean;
}

const ACTIONS: readonly ActionDef[] = [
  {
    action: 'resend-verification',
    permission: 'users.support',
    copy: es.userDetail.actions.resendVerification,
    visible: (user) => !user.emailVerified,
  },
  {
    action: 'send-password-reset',
    permission: 'users.support',
    copy: es.userDetail.actions.sendPasswordReset,
    visible: () => true,
  },
  {
    action: 'clear-throttle',
    permission: 'users.support',
    copy: es.userDetail.actions.clearThrottle,
    visible: (user) => user.throttle !== null,
  },
  {
    action: 'logout-everywhere',
    permission: 'users.support',
    copy: es.userDetail.actions.logoutEverywhere,
    visible: () => true,
  },
  {
    action: 'suspend',
    permission: 'users.suspend',
    copy: es.userDetail.actions.suspend,
    destructive: true,
    visible: (user) => user.status !== 'SUSPENDED',
  },
  {
    action: 'reactivate',
    permission: 'users.suspend',
    copy: es.userDetail.actions.reactivate,
    visible: (user) => user.status === 'SUSPENDED',
  },
];

type OpenDialog = { kind: 'action'; def: ActionDef } | { kind: 'delete' };

interface UserDetailScreenProps {
  me: Me;
  userId: string;
}

export function UserDetailScreen({ me, userId }: UserDetailScreenProps) {
  const { data, error, loading, reload } = useResource(`user:${userId}`, () =>
    usersApi.get(userId),
  );
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [deleted, setDeleted] = useState(false);

  async function run(task: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await task();
      setBanner({ kind: 'success', text: success });
    } catch (err) {
      setBanner({
        kind: 'error',
        text: es.userDetail.actionFailed(errorMessage(err)),
      });
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  async function runAction(def: ActionDef) {
    await run(() => usersApi.action(userId, def.action), def.copy.success);
    reload();
  }

  async function runDelete(confirmEmail: string) {
    let ok = false;
    await run(async () => {
      await usersApi.remove(userId, confirmEmail);
      ok = true;
    }, es.userDetail.actions.delete.success);
    if (ok) setDeleted(true);
    else reload();
  }

  const actions = data
    ? ACTIONS.filter((def) => can(me, def.permission) && def.visible(data))
    : [];
  const canDelete = can(me, 'users.delete');

  return (
    <section aria-labelledby="user-title">
      <p>
        <a href={href(paths.users)}>{es.userDetail.back}</a>
      </p>
      <h1 id="user-title">{data?.email ?? es.users.title}</h1>
      <Banner message={banner} onDismiss={() => setBanner(null)} />
      {error && !deleted ? <ErrorText>{errorMessage(error)}</ErrorText> : null}
      {loading && !data ? <Loading /> : null}
      {data && !deleted ? (
        <>
          <section className="card" aria-labelledby="user-summary">
            <h2 id="user-summary">{es.userDetail.summary}</h2>
            <dl className="details">
              <dt>{es.users.username}</dt>
              <dd>{data.username}</dd>
              <dt>{es.users.status}</dt>
              <dd>
                <span className={`pill pill--${data.status}`}>
                  {es.users.statuses[data.status]}
                </span>
              </dd>
              <dt>{es.users.verified}</dt>
              <dd>{data.emailVerified ? es.users.yes : es.users.no}</dd>
              <dt>{es.users.pro}</dt>
              <dd>{data.isPro ? es.users.yes : es.users.no}</dd>
              <dt>{es.users.createdAt}</dt>
              <dd>{formatDateTime(data.createdAt)}</dd>
              <dt>{es.users.lastLogin}</dt>
              <dd>
                {data.lastLoginAt
                  ? formatDateTime(data.lastLoginAt)
                  : es.users.never}
              </dd>
              <dt>{es.users.lastSync}</dt>
              <dd>{formatDateTime(data.lastSyncAt)}</dd>
            </dl>
          </section>

          {actions.length > 0 || canDelete ? (
            <section className="card" aria-labelledby="user-actions">
              <h2 id="user-actions">{es.userDetail.actionsTitle}</h2>
              <div className="button-row button-row--wrap">
                {actions.map((def) => (
                  <button
                    key={def.action}
                    type="button"
                    className={`button ${def.destructive ? 'button--danger-outline' : 'button--secondary'}`}
                    onClick={() => setDialog({ kind: 'action', def })}
                  >
                    {def.copy.button}
                  </button>
                ))}
                {canDelete ? (
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => setDialog({ kind: 'delete' })}
                  >
                    {es.userDetail.actions.delete.button}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <DevicesSection user={data} />
          <ThrottleSection user={data} />
          <FailedSyncSection user={data} />

          {dialog?.kind === 'action' ? (
            <ConfirmDialog
              title={dialog.def.copy.title}
              confirmLabel={dialog.def.copy.confirm}
              destructive={dialog.def.destructive ?? false}
              busy={busy}
              onCancel={() => setDialog(null)}
              onConfirm={() => void runAction(dialog.def)}
            >
              <p>{dialog.def.copy.body}</p>
            </ConfirmDialog>
          ) : null}
          {dialog?.kind === 'delete' ? (
            <DeleteUserDialog
              email={data.email}
              busy={busy}
              onCancel={() => setDialog(null)}
              onConfirm={(typed) => void runDelete(typed)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function DeleteUserDialog({
  email,
  busy,
  onCancel,
  onConfirm,
}: {
  email: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (typedEmail: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const copy = es.userDetail.actions.delete;
  const matches = typed === email;

  return (
    <ConfirmDialog
      title={copy.title}
      confirmLabel={copy.confirm}
      destructive
      busy={busy}
      confirmDisabled={!matches}
      onCancel={onCancel}
      onConfirm={() => {
        if (matches) onConfirm(typed);
      }}
    >
      <p className="danger-text">{copy.body}</p>
      <div className="field">
        <label htmlFor="delete-confirm-email">{copy.typeEmailLabel}</label>
        <p id="delete-confirm-hint" className="hint">
          {copy.typeEmail(email)}
        </p>
        <input
          id="delete-confirm-email"
          type="email"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="delete-confirm-hint"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}

function DevicesSection({ user }: { user: UserDetail }) {
  return (
    <section className="card" aria-labelledby="user-devices">
      <h2 id="user-devices">{es.userDetail.devicesTitle}</h2>
      {user.devices.length === 0 ? (
        <p className="muted">{es.userDetail.noDevices}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">
              {es.userDetail.devicesCaption}
            </caption>
            <thead>
              <tr>
                <th scope="col">{es.userDetail.deviceName}</th>
                <th scope="col">{es.userDetail.platform}</th>
                <th scope="col">{es.userDetail.lastSeen}</th>
                <th scope="col">{es.userDetail.revoked}</th>
              </tr>
            </thead>
            <tbody>
              {user.devices.map((device) => (
                <tr key={device.id}>
                  <th scope="row">{device.name ?? es.common.dash}</th>
                  <td>{device.platform}</td>
                  <td>{formatDateTime(device.lastSeenAt)}</td>
                  <td>
                    {device.revokedAt
                      ? formatDateTime(device.revokedAt)
                      : es.userDetail.notRevoked}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ThrottleSection({ user }: { user: UserDetail }) {
  const throttle = user.throttle;
  return (
    <section className="card" aria-labelledby="user-throttle">
      <h2 id="user-throttle">{es.userDetail.throttleTitle}</h2>
      {throttle ? (
        <dl className="details">
          <dt>{es.userDetail.failures}</dt>
          <dd>{formatNumber(throttle.failures)}</dd>
          <dt>{es.userDetail.lastFailedAt}</dt>
          <dd>{formatDateTime(throttle.lastFailedAt)}</dd>
          <dt>{es.userDetail.lockedUntil}</dt>
          <dd>
            {throttle.lockedUntil
              ? formatDateTime(throttle.lockedUntil)
              : es.userDetail.notLocked}
          </dd>
        </dl>
      ) : (
        <p className="muted">{es.userDetail.throttleNone}</p>
      )}
    </section>
  );
}

function FailedSyncSection({ user }: { user: UserDetail }) {
  return (
    <section className="card" aria-labelledby="user-sync">
      <h2 id="user-sync">{es.userDetail.syncTitle}</h2>
      {user.recentFailedSyncOps.length === 0 ? (
        <p className="muted">{es.userDetail.syncNone}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">
              {es.userDetail.syncCaption}
            </caption>
            <thead>
              <tr>
                <th scope="col">{es.userDetail.appliedAt}</th>
                <th scope="col">{es.userDetail.entityType}</th>
                <th scope="col">{es.userDetail.operation}</th>
                <th scope="col">{es.userDetail.opStatus}</th>
                <th scope="col">{es.userDetail.errorCode}</th>
              </tr>
            </thead>
            <tbody>
              {user.recentFailedSyncOps.map((op) => (
                <tr key={op.id}>
                  <th scope="row">{formatDateTime(op.appliedAt)}</th>
                  <td>{op.entityType}</td>
                  <td>{op.operation}</td>
                  <td>{op.status}</td>
                  <td>{op.errorCode ?? es.common.dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
