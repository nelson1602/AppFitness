import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { usersApi } from '../api/endpoints';
import type { UserListQuery } from '../api/endpoints';
import type { Me, SortOrder, UserSortField, UserStatus } from '../api/types';
import { Banner, ErrorText, Loading } from '../components/Banner';
import type { BannerMessage } from '../components/Banner';
import { Pagination } from '../components/Pagination';
import { formatDateTime, formatNumber } from '../format';
import { useResource } from '../hooks/useResource';
import { es } from '../i18n/es';
import { can } from '../permissions';
import { href, paths } from '../router';

const PAGE_SIZE = 25;
const STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'PENDING_DELETION'];

function isStatus(value: string): value is UserStatus {
  return (STATUSES as string[]).includes(value);
}

/** Local calendar day as `YYYY-MM-DD`, for the export file name. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Hands a Blob to the browser as a file download, then frees its URL. */
function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Revoke on the next tick so every browser has started the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** The table's columns, in order, each with the server field it sorts by. */
const COLUMNS: { field: UserSortField; label: string }[] = [
  { field: 'email', label: es.users.email },
  { field: 'username', label: es.users.username },
  { field: 'status', label: es.users.status },
  { field: 'emailVerified', label: es.users.verified },
  { field: 'isPro', label: es.users.pro },
  { field: 'deviceCount', label: es.users.devices },
  { field: 'lastLoginAt', label: es.users.lastLogin },
  { field: 'lastSyncAt', label: es.users.lastSync },
  { field: 'createdAt', label: es.users.createdAt },
];

/** Same column: flip the order. Another column: start ascending. */
export function nextSort(
  current: { sort: UserSortField; order: SortOrder },
  field: UserSortField,
): { sort: UserSortField; order: SortOrder } {
  if (current.sort === field) {
    return { sort: field, order: current.order === 'asc' ? 'desc' : 'asc' };
  }
  return { sort: field, order: 'asc' };
}

function SortHeader({
  field,
  label,
  sort,
  order,
  onSort,
}: {
  field: UserSortField;
  label: string;
  sort: UserSortField;
  order: SortOrder;
  onSort: (field: UserSortField) => void;
}) {
  const active = sort === field;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <button
        type="button"
        className="sort-button"
        onClick={() => onSort(field)}
      >
        {label}
        <span className="sort-indicator" aria-hidden="true">
          {active ? (order === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

export function UsersScreen({ me }: { me: Me }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  // Newest first until a header is chosen (the server's default too).
  const [query, setQuery] = useState<UserListQuery>({
    q: '',
    status: '',
    sort: 'createdAt',
    order: 'desc',
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const { data, error, loading } = useResource(JSON.stringify(query), () =>
    usersApi.list(query),
  );

  const [exporting, setExporting] = useState(false);
  const [banner, setBanner] = useState<BannerMessage | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery((prev) => ({ ...prev, q: q.trim(), status, page: 1 }));
  }

  function sortBy(field: UserSortField) {
    setQuery((prev) => ({ ...prev, ...nextSort(prev, field), page: 1 }));
  }

  // Exports with the filter and sort currently applied to the list.
  async function exportCsv() {
    setExporting(true);
    setBanner(null);
    try {
      const blob = await usersApi.exportCsv({
        q: query.q,
        status: query.status,
        sort: query.sort,
        order: query.order,
      });
      saveBlob(blob, es.users.exportFileName(localDay(new Date())));
    } catch (err) {
      setBanner({
        kind: 'error',
        text: es.users.exportFailed(errorMessage(err)),
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <section aria-labelledby="users-title">
      <h1 id="users-title">{es.users.title}</h1>
      <form className="filters" role="search" onSubmit={submit}>
        <div className="field field--grow">
          <label htmlFor="users-q">{es.users.searchLabel}</label>
          <input
            id="users-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="users-status">{es.users.statusLabel}</label>
          <select
            id="users-status"
            value={status}
            onChange={(e) =>
              setStatus(isStatus(e.target.value) ? e.target.value : '')
            }
          >
            <option value="">{es.users.statusAll}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {es.users.statuses[value]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button button--primary">
          {es.users.search}
        </button>
      </form>

      {can(me, 'users.export') ? (
        <div className="export-row">
          <button
            type="button"
            className="button button--secondary"
            disabled={exporting}
            aria-describedby="users-export-note"
            onClick={() => void exportCsv()}
          >
            {exporting ? es.users.exporting : es.users.exportCsv}
          </button>
          <p id="users-export-note" className="hint">
            {es.users.exportNote}
          </p>
        </div>
      ) : null}
      <Banner message={banner} onDismiss={() => setBanner(null)} />

      {error ? <ErrorText>{errorMessage(error)}</ErrorText> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <p className="muted" role="status">
            {es.users.resultCount(data.total)}
          </p>
          {data.items.length === 0 ? (
            <p>{es.users.empty}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">
                  {es.users.caption}
                </caption>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <SortHeader
                        key={column.field}
                        field={column.field}
                        label={column.label}
                        sort={query.sort}
                        order={query.order}
                        onSort={sortBy}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user.id}>
                      <th scope="row">
                        <a href={href(paths.user(user.id))}>{user.email}</a>
                      </th>
                      <td>{user.username}</td>
                      <td>
                        <span className={`pill pill--${user.status}`}>
                          {es.users.statuses[user.status]}
                        </span>
                      </td>
                      <td>{user.emailVerified ? es.users.yes : es.users.no}</td>
                      <td>{user.isPro ? es.users.yes : es.users.no}</td>
                      <td>{formatNumber(user.deviceCount)}</td>
                      <td>
                        {user.lastLoginAt
                          ? formatDateTime(user.lastLoginAt)
                          : es.users.never}
                      </td>
                      <td>{formatDateTime(user.lastSyncAt)}</td>
                      <td>{formatDateTime(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(page) => setQuery((prev) => ({ ...prev, page }))}
          />
        </>
      ) : null}
    </section>
  );
}
