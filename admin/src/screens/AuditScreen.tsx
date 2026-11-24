import { Fragment, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { auditApi } from '../api/endpoints';
import type { AuditQuery } from '../api/endpoints';
import type { AuditEntry } from '../api/types';
import { ErrorText, Loading } from '../components/Banner';
import { Pagination } from '../components/Pagination';
import { formatDateTime, prettyJson } from '../format';
import { useResource } from '../hooks/useResource';
import { es } from '../i18n/es';

const PAGE_SIZE = 50;

type Filters = Omit<AuditQuery, 'page' | 'pageSize'>;

const EMPTY_FILTERS: Filters = {
  staffId: '',
  action: '',
  targetType: '',
  targetId: '',
  from: '',
  to: '',
};

const FILTER_FIELDS: { key: keyof Filters; label: string; type: string }[] = [
  { key: 'action', label: es.audit.action, type: 'text' },
  { key: 'staffId', label: es.audit.staffId, type: 'text' },
  { key: 'targetType', label: es.audit.targetType, type: 'text' },
  { key: 'targetId', label: es.audit.targetId, type: 'text' },
  { key: 'from', label: es.audit.from, type: 'date' },
  { key: 'to', label: es.audit.to, type: 'date' },
];

export function AuditScreen() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<AuditQuery>({
    ...EMPTY_FILTERS,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, error, loading } = useResource(JSON.stringify(query), () =>
    auditApi.list(query),
  );

  function trimmed(filters: Filters): Filters {
    return {
      staffId: filters.staffId.trim(),
      action: filters.action.trim(),
      targetType: filters.targetType.trim(),
      targetId: filters.targetId.trim(),
      from: filters.from,
      to: filters.to,
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setExpanded(null);
    setQuery({ ...trimmed(draft), page: 1, pageSize: PAGE_SIZE });
  }

  function clear() {
    setDraft(EMPTY_FILTERS);
    setExpanded(null);
    setQuery({ ...EMPTY_FILTERS, page: 1, pageSize: PAGE_SIZE });
  }

  return (
    <section aria-labelledby="audit-title">
      <h1 id="audit-title">{es.audit.title}</h1>
      <form className="card" onSubmit={submit} aria-labelledby="audit-filters">
        <h2 id="audit-filters">{es.audit.filters}</h2>
        <div className="filter-grid">
          {FILTER_FIELDS.map((field) => (
            <div key={field.key} className="field">
              <label htmlFor={`audit-${field.key}`}>{field.label}</label>
              <input
                id={`audit-${field.key}`}
                type={field.type}
                value={draft[field.key]}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button button--secondary"
            onClick={clear}
          >
            {es.audit.clear}
          </button>
          <button type="submit" className="button button--primary">
            {es.audit.apply}
          </button>
        </div>
      </form>

      {error ? <ErrorText>{errorMessage(error)}</ErrorText> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          {data.items.length === 0 ? (
            <p>{es.audit.empty}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">
                  {es.audit.caption}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{es.audit.createdAt}</th>
                    <th scope="col">{es.audit.action}</th>
                    <th scope="col">{es.audit.staff}</th>
                    <th scope="col">{es.audit.target}</th>
                    <th scope="col">{es.audit.ip}</th>
                    <th scope="col">{es.audit.details}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((entry) => (
                    <AuditRow
                      key={entry.id}
                      entry={entry}
                      open={expanded === entry.id}
                      onToggle={() =>
                        setExpanded((prev) =>
                          prev === entry.id ? null : entry.id,
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(page) => {
              setExpanded(null);
              setQuery((prev) => ({ ...prev, page }));
            }}
          />
        </>
      ) : null}
    </section>
  );
}

function AuditRow({
  entry,
  open,
  onToggle,
}: {
  entry: AuditEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const detailsId = `audit-details-${entry.id}`;
  const target = [entry.targetType, entry.targetId].filter(Boolean).join(' · ');
  return (
    <Fragment>
      <tr>
        <th scope="row">{formatDateTime(entry.createdAt)}</th>
        <td>
          <code>{entry.action}</code>
        </td>
        <td>{entry.staffEmail ?? entry.staffId ?? es.common.dash}</td>
        <td className="break">{target || es.common.dash}</td>
        <td>{entry.ip ?? es.common.dash}</td>
        <td>
          <button
            type="button"
            className="button button--ghost"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={onToggle}
          >
            {open ? es.audit.hide : es.audit.show}
          </button>
        </td>
      </tr>
      <tr id={detailsId} hidden={!open} className="audit-details">
        <td colSpan={6}>
          {open ? (
            <div className="diff">
              <div>
                <h3>{es.audit.before}</h3>
                <pre>{prettyJson(entry.before)}</pre>
              </div>
              <div>
                <h3>{es.audit.after}</h3>
                <pre>{prettyJson(entry.after)}</pre>
              </div>
            </div>
          ) : null}
        </td>
      </tr>
    </Fragment>
  );
}
