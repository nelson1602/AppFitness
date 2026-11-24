import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { usersApi } from '../api/endpoints';
import type { UserListQuery } from '../api/endpoints';
import type { UserStatus } from '../api/types';
import { ErrorText, Loading } from '../components/Banner';
import { Pagination } from '../components/Pagination';
import { formatDateTime, formatNumber } from '../format';
import { useResource } from '../hooks/useResource';
import { es } from '../i18n/es';
import { href, paths } from '../router';

const PAGE_SIZE = 25;
const STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'PENDING_DELETION'];

function isStatus(value: string): value is UserStatus {
  return (STATUSES as string[]).includes(value);
}

export function UsersScreen() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [query, setQuery] = useState<UserListQuery>({
    q: '',
    status: '',
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const { data, error, loading } = useResource(JSON.stringify(query), () =>
    usersApi.list(query),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery({ q: q.trim(), status, page: 1, pageSize: PAGE_SIZE });
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
                    <th scope="col">{es.users.email}</th>
                    <th scope="col">{es.users.username}</th>
                    <th scope="col">{es.users.status}</th>
                    <th scope="col">{es.users.verified}</th>
                    <th scope="col">{es.users.pro}</th>
                    <th scope="col">{es.users.devices}</th>
                    <th scope="col">{es.users.lastLogin}</th>
                    <th scope="col">{es.users.lastSync}</th>
                    <th scope="col">{es.users.createdAt}</th>
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
