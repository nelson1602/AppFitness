import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { rolesApi, staffApi } from '../api/endpoints';
import type { Role, StaffMember } from '../api/types';
import { Banner, ErrorText, Loading } from '../components/Banner';
import type { BannerMessage } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDateTime } from '../format';
import { useResource } from '../hooks/useResource';
import { es } from '../i18n/es';

export function StaffScreen() {
  const staff = useResource('staff', () => staffApi.list());
  const roles = useResource('roles', () => rolesApi.list());
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);

  // The role picker never offers system roles (SUPER_ADMIN).
  const assignable = (roles.data ?? []).filter((role) => !role.isSystem);

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await task();
      setBanner({ kind: 'success', text: success });
      return true;
    } catch (err) {
      setBanner({ kind: 'error', text: errorMessage(err) });
      return false;
    } finally {
      setBusy(false);
      staff.reload();
    }
  }

  return (
    <section aria-labelledby="staff-title">
      <h1 id="staff-title">{es.staff.title}</h1>
      <Banner message={banner} onDismiss={() => setBanner(null)} />

      <InviteForm
        roles={assignable}
        rolesError={roles.error}
        busy={busy}
        onInvite={(email, roleId, displayName) =>
          run(
            () => staffApi.invite(email, roleId, displayName),
            es.staff.invited(email),
          )
        }
      />

      {staff.error ? <ErrorText>{errorMessage(staff.error)}</ErrorText> : null}
      {staff.loading && !staff.data ? <Loading /> : null}
      {staff.data ? (
        staff.data.length === 0 ? (
          <p>{es.staff.empty}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">{es.staff.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{es.staff.email}</th>
                  <th scope="col">{es.staff.displayName}</th>
                  <th scope="col">{es.staff.role}</th>
                  <th scope="col">{es.staff.status}</th>
                  <th scope="col">{es.staff.lastLogin}</th>
                  <th scope="col">{es.staff.actions}</th>
                </tr>
              </thead>
              <tbody>
                {staff.data.map((member) =>
                  editing === member.id && !member.role.isSystem ? (
                    <EditRow
                      key={member.id}
                      member={member}
                      roles={assignable}
                      busy={busy}
                      onCancel={() => setEditing(null)}
                      onSave={async (patch) => {
                        if (
                          await run(
                            () => staffApi.update(member.id, patch),
                            es.staff.saved,
                          )
                        )
                          setEditing(null);
                      }}
                    />
                  ) : (
                    <StaffRow
                      key={member.id}
                      member={member}
                      busy={busy}
                      onEdit={() => setEditing(member.id)}
                      onResend={() =>
                        void run(
                          () => staffApi.resendInvite(member.id),
                          es.staff.resent,
                        )
                      }
                      onDisable={() => setDisabling(member)}
                      onEnable={() =>
                        void run(
                          () => staffApi.enable(member.id),
                          es.staff.enabled,
                        )
                      }
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {disabling ? (
        <ConfirmDialog
          title={es.staff.disableTitle}
          confirmLabel={es.staff.disable}
          cancelLabel={es.staff.cancel}
          destructive
          busy={busy}
          onCancel={() => setDisabling(null)}
          onConfirm={() =>
            void run(
              () => staffApi.disable(disabling.id),
              es.staff.disabled,
            ).then(() => setDisabling(null))
          }
        >
          <p>{es.staff.disableBody(disabling.email)}</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

export function StaffRow({
  member,
  busy,
  onEdit,
  onResend,
  onDisable,
  onEnable,
}: {
  member: StaffMember;
  busy: boolean;
  onEdit: () => void;
  onResend: () => void;
  onDisable: () => void;
  onEnable: () => void;
}) {
  return (
    <tr>
      <th scope="row">{member.email}</th>
      <td>{member.displayName ?? es.common.dash}</td>
      <td>{member.role.name}</td>
      <td>{es.staff.statuses[member.status]}</td>
      <td>{formatDateTime(member.lastLoginAt)}</td>
      <td>
        {member.role.isSystem ? (
          <span className="muted">{es.staff.owner}</span>
        ) : (
          <div className="button-row button-row--wrap">
            <button
              type="button"
              className="button button--secondary"
              onClick={onEdit}
              disabled={busy}
              aria-label={es.staff.editTitle(member.email)}
            >
              {es.staff.edit}
            </button>
            {member.status === 'INVITED' ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={onResend}
                disabled={busy}
              >
                {es.staff.resend}
              </button>
            ) : null}
            {member.status === 'DISABLED' ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={onEnable}
                disabled={busy}
              >
                {es.staff.enable}
              </button>
            ) : (
              <button
                type="button"
                className="button button--danger-outline"
                onClick={onDisable}
                disabled={busy}
              >
                {es.staff.disable}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function EditRow({
  member,
  roles,
  busy,
  onCancel,
  onSave,
}: {
  member: StaffMember;
  roles: Role[];
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: { roleId?: string; displayName?: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(member.displayName ?? '');
  const [roleId, setRoleId] = useState(member.role.id);
  const nameId = `staff-name-${member.id}`;
  const roleSelectId = `staff-role-${member.id}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    const patch: { roleId?: string; displayName?: string } = {};
    if (roleId !== member.role.id) patch.roleId = roleId;
    if (displayName.trim() !== (member.displayName ?? ''))
      patch.displayName = displayName.trim();
    void onSave(patch);
  }

  return (
    <tr>
      <th scope="row">{member.email}</th>
      <td colSpan={5}>
        <form
          className="inline-form"
          onSubmit={submit}
          aria-label={es.staff.editTitle(member.email)}
        >
          <div className="field">
            <label htmlFor={nameId}>{es.staff.displayName}</label>
            <input
              id={nameId}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={roleSelectId}>{es.staff.role}</label>
            <select
              id={roleSelectId}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.some((role) => role.id === member.role.id) ? null : (
                <option value={member.role.id}>{member.role.name}</option>
              )}
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="button button--secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {es.staff.cancel}
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={busy}
            >
              {es.staff.save}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function InviteForm({
  roles,
  rolesError,
  busy,
  onInvite,
}: {
  roles: Role[];
  rolesError: unknown;
  busy: boolean;
  onInvite: (
    email: string,
    roleId: string,
    displayName?: string,
  ) => Promise<boolean>;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleId, setRoleId] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await onInvite(
      email.trim(),
      roleId,
      displayName.trim() || undefined,
    );
    if (ok) {
      setEmail('');
      setDisplayName('');
      setRoleId('');
    }
  }

  return (
    <section className="card" aria-labelledby="staff-invite">
      <h2 id="staff-invite">{es.staff.inviteTitle}</h2>
      {rolesError ? <ErrorText>{errorMessage(rolesError)}</ErrorText> : null}
      {!rolesError && roles.length === 0 ? (
        <p className="muted">{es.staff.noRoles}</p>
      ) : null}
      <form className="inline-form" onSubmit={(e) => void submit(e)}>
        <div className="field field--grow">
          <label htmlFor="invite-email">{es.staff.inviteEmail}</label>
          <input
            id="invite-email"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="invite-name">{es.staff.inviteName}</label>
          <input
            id="invite-name"
            type="text"
            autoComplete="off"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="invite-role">{es.staff.inviteRole}</label>
          <select
            id="invite-role"
            required
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">{es.staff.chooseRole}</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="button button--primary"
          disabled={busy || !email.trim() || !roleId}
        >
          {es.staff.inviteSubmit}
        </button>
      </form>
    </section>
  );
}
