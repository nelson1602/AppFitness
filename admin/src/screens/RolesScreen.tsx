import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { rolesApi } from '../api/endpoints';
import type { RoleInput } from '../api/endpoints';
import { OWNER_ONLY_PERMISSIONS } from '../api/types';
import type { PermissionInfo, Role } from '../api/types';
import { Banner, ErrorText, Loading } from '../components/Banner';
import type { BannerMessage } from '../components/Banner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useResource } from '../hooks/useResource';
import { es } from '../i18n/es';

export function RolesScreen() {
  const roles = useRoles();
  const permissions = usePermissions();
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await task();
      setBanner({ kind: 'success', text: success });
      return true;
    } catch (err) {
      setBanner({
        kind: 'error',
        text:
          err instanceof ApiError && err.status === 409
            ? es.roles.deleteInUse
            : errorMessage(err),
      });
      return false;
    } finally {
      setBusy(false);
      roles.reload();
    }
  }

  const permissionList = permissions.data ?? [];

  return (
    <section aria-labelledby="roles-title">
      <h1 id="roles-title">{es.roles.title}</h1>
      <Banner message={banner} onDismiss={() => setBanner(null)} />
      {permissions.error ? (
        <ErrorText>{errorMessage(permissions.error)}</ErrorText>
      ) : null}

      <section className="card" aria-labelledby="role-create">
        <h2 id="role-create">{es.roles.createTitle}</h2>
        <RoleForm
          idPrefix="new-role"
          permissions={permissionList}
          submitLabel={es.roles.create}
          busy={busy}
          resetOnSuccess
          onSubmit={(input) =>
            run(() => rolesApi.create(input), es.roles.created)
          }
        />
      </section>

      {roles.error ? <ErrorText>{errorMessage(roles.error)}</ErrorText> : null}
      {roles.loading && !roles.data ? <Loading /> : null}
      {roles.data?.length === 0 ? <p>{es.roles.empty}</p> : null}
      <ul className="role-list">
        {(roles.data ?? []).map((role) => (
          <li key={role.id} className="card role">
            {editing === role.id && !role.isSystem ? (
              <>
                <h2>{es.roles.editTitle(role.name)}</h2>
                <RoleForm
                  idPrefix={`role-${role.id}`}
                  permissions={permissionList}
                  initial={role}
                  submitLabel={es.roles.save}
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (input) => {
                    const ok = await run(
                      () => rolesApi.update(role.id, input),
                      es.roles.saved,
                    );
                    if (ok) setEditing(null);
                    return ok;
                  }}
                />
              </>
            ) : (
              <RoleView
                role={role}
                busy={busy}
                onEdit={() => setEditing(role.id)}
                onDelete={() => setDeleting(role)}
              />
            )}
          </li>
        ))}
      </ul>

      {deleting ? (
        <ConfirmDialog
          title={es.roles.deleteTitle}
          confirmLabel={es.roles.delete}
          cancelLabel={es.roles.cancel}
          destructive
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            void run(() => rolesApi.remove(deleting.id), es.roles.deleted).then(
              () => setDeleting(null),
            )
          }
        >
          <p>{es.roles.deleteBody(deleting.name)}</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

function useRoles() {
  return useResource('roles', () => rolesApi.list());
}

function usePermissions() {
  return useResource('permissions', () => rolesApi.permissions());
}

export function RoleView({
  role,
  busy,
  onEdit,
  onDelete,
}: {
  role: Role;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="role__header">
        <h2>{role.name}</h2>
        {role.isSystem ? <span className="pill">{es.roles.system}</span> : null}
      </div>
      {role.description ? <p>{role.description}</p> : null}
      <p className="muted">{es.roles.staffCount(role.staffCount)}</p>
      {role.permissions.length === 0 ? (
        <p className="muted">{es.roles.noPermissions}</p>
      ) : (
        <ul className="tag-list" aria-label={es.roles.permissions}>
          {role.permissions.map((key) => (
            <li key={key} className="tag">
              <code>{key}</code>
            </li>
          ))}
        </ul>
      )}
      {role.isSystem ? null : (
        <div className="button-row">
          <button
            type="button"
            className="button button--secondary"
            onClick={onEdit}
            disabled={busy}
          >
            {es.roles.edit}
          </button>
          <button
            type="button"
            className="button button--danger-outline"
            onClick={onDelete}
            disabled={busy}
          >
            {es.roles.delete}
          </button>
        </div>
      )}
    </>
  );
}

function RoleForm({
  idPrefix,
  permissions,
  initial,
  submitLabel,
  busy,
  resetOnSuccess = false,
  onCancel,
  onSubmit,
}: {
  idPrefix: string;
  permissions: PermissionInfo[];
  initial?: Role;
  submitLabel: string;
  busy: boolean;
  resetOnSuccess?: boolean;
  onCancel?: () => void;
  onSubmit: (input: RoleInput) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [selected, setSelected] = useState<string[]>(
    (initial?.permissions ?? []).filter(
      (key) => !OWNER_ONLY_PERMISSIONS.includes(key),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string, checked: boolean) {
    setSelected((prev) =>
      checked ? [...prev, key] : prev.filter((item) => item !== key),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(es.roles.nameRequired);
      return;
    }
    setError(null);
    const input: RoleInput = {
      name: name.trim(),
      permissions: selected.filter(
        (key) => !OWNER_ONLY_PERMISSIONS.includes(key),
      ),
    };
    if (description.trim()) input.description = description.trim();
    const ok = await onSubmit(input);
    if (ok && resetOnSuccess) {
      setName('');
      setDescription('');
      setSelected([]);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <ErrorText>{error}</ErrorText>
      <div className="field">
        <label htmlFor={`${idPrefix}-name`}>{es.roles.name}</label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-description`}>
          {es.roles.description}
        </label>
        <textarea
          id={`${idPrefix}-description`}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <fieldset className="permission-grid">
        <legend>{es.roles.permissions}</legend>
        {permissions.map((permission) => {
          const ownerOnly = OWNER_ONLY_PERMISSIONS.includes(permission.key);
          const inputId = `${idPrefix}-perm-${permission.key}`;
          const noteId = `${inputId}-note`;
          return (
            <div key={permission.key} className="checkbox">
              <input
                id={inputId}
                type="checkbox"
                checked={!ownerOnly && selected.includes(permission.key)}
                disabled={ownerOnly}
                aria-describedby={ownerOnly ? noteId : undefined}
                onChange={(e) => toggle(permission.key, e.target.checked)}
              />
              <label htmlFor={inputId}>
                <code>{permission.key}</code>
                <span className="block muted">{permission.description}</span>
                {ownerOnly ? (
                  <span id={noteId} className="block hint">
                    {es.roles.ownerOnly}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })}
      </fieldset>
      <div className="button-row">
        {onCancel ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {es.roles.cancel}
          </button>
        ) : null}
        <button
          type="submit"
          className="button button--primary"
          disabled={busy}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
