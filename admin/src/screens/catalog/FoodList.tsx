import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { catalogApi } from '../../api/endpoints';
import type { FoodListQuery } from '../../api/endpoints';
import { FOOD_KINDS } from '../../api/types';
import type {
  CatalogFoodInput,
  CatalogFoodView,
  FoodKind,
} from '../../api/types';
import { ErrorText, Loading } from '../../components/Banner';
import { Pagination } from '../../components/Pagination';
import { formatNumber } from '../../format';
import { useResource } from '../../hooks/useResource';
import { es } from '../../i18n/es';
import { href, paths } from '../../router';
import type { NotifyFn } from './catalogFormat';
import { servingText } from './catalogFormat';
import { FoodForm } from './FoodForm';

const PAGE_SIZE = 25;
const LIST_STATUSES = ['active', 'retired'] as const;
type ListStatus = (typeof LIST_STATUSES)[number];

function isKind(value: string): value is FoodKind {
  return (FOOD_KINDS as readonly string[]).includes(value);
}

function isListStatus(value: string): value is ListStatus {
  return (LIST_STATUSES as readonly string[]).includes(value);
}

export function FoodList({ onNotice }: { onNotice: NotifyFn }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<FoodKind | ''>('');
  const [status, setStatus] = useState<ListStatus | ''>('');
  const [query, setQuery] = useState<FoodListQuery>({
    q: '',
    kind: '',
    status: '',
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useResource(
    `catalog-foods:${JSON.stringify(query)}`,
    () => catalogApi.foods(query),
  );
  const t = es.catalog.foods;

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery({ q: q.trim(), kind, status, page: 1, pageSize: PAGE_SIZE });
  }

  async function create(input: CatalogFoodInput) {
    await catalogApi.createFood(input);
    setAdding(false);
    onNotice(null, { kind: 'success', text: t.created });
    reload();
  }

  return (
    <>
      <form className="filters" role="search" onSubmit={submit}>
        <div className="field field--grow">
          <label htmlFor="catalog-foods-q">{t.searchLabel}</label>
          <input
            id="catalog-foods-q"
            type="search"
            maxLength={80}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="catalog-foods-kind">{t.kindLabel}</label>
          <select
            id="catalog-foods-kind"
            value={kind}
            onChange={(e) =>
              setKind(isKind(e.target.value) ? e.target.value : '')
            }
          >
            <option value="">{t.kindAll}</option>
            {FOOD_KINDS.map((value) => (
              <option key={value} value={value}>
                {es.catalog.kinds[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="catalog-foods-status">{t.statusLabel}</label>
          <select
            id="catalog-foods-status"
            value={status}
            onChange={(e) =>
              setStatus(isListStatus(e.target.value) ? e.target.value : '')
            }
          >
            <option value="">{t.statusAll}</option>
            {LIST_STATUSES.map((value) => (
              <option key={value} value={value}>
                {es.catalog.statuses[value]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button button--primary">
          {t.search}
        </button>
      </form>

      {adding ? (
        <FoodForm
          title={es.catalog.form.createTitle}
          submitLabel={es.catalog.form.create}
          onSubmit={create}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="button-row">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setAdding(true)}
          >
            {t.add}
          </button>
        </div>
      )}

      {error ? <ErrorText>{errorMessage(error)}</ErrorText> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <p className="muted" role="status">
            {t.resultCount(data.total)}
          </p>
          {data.items.length === 0 ? (
            <p>{t.empty}</p>
          ) : (
            <FoodTable foods={data.items} />
          )}
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(page) => setQuery((prev) => ({ ...prev, page }))}
          />
        </>
      ) : null}
    </>
  );
}

function FoodTable({ foods }: { foods: CatalogFoodView[] }) {
  const t = es.catalog.foods;
  return (
    <div className="table-wrap">
      <table>
        <caption className="visually-hidden">{t.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.name}</th>
            <th scope="col">{t.brand}</th>
            <th scope="col">{t.kind}</th>
            <th scope="col">{t.status}</th>
            <th scope="col">{t.serving}</th>
            <th scope="col">{t.calories}</th>
            <th scope="col">{t.revision}</th>
          </tr>
        </thead>
        <tbody>
          {foods.map((food) => (
            <tr key={food.id}>
              <th scope="row">
                <a href={href(paths.catalogFood(food.id))}>{food.name}</a>
              </th>
              <td>{food.brand ?? es.common.dash}</td>
              <td>{es.catalog.kinds[food.kind]}</td>
              <td>
                <span className={`pill pill--${food.status}`}>
                  {es.catalog.statuses[food.status]}
                </span>
              </td>
              <td>{servingText(food)}</td>
              <td>{formatNumber(food.caloriesPerServing)}</td>
              <td>{formatNumber(food.foodRevision)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
