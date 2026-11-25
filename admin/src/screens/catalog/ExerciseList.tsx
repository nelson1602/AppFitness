import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { catalogApi } from '../../api/endpoints';
import type { ExerciseListQuery } from '../../api/endpoints';
import type { CatalogExercise } from '../../api/types';
import { ErrorText, Loading } from '../../components/Banner';
import { Pagination } from '../../components/Pagination';
import { useResource } from '../../hooks/useResource';
import { es } from '../../i18n/es';

const PAGE_SIZE = 25;

/** Read-only: phones receive the exercise catalogue with the app. */
export function ExerciseList() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState<ExerciseListQuery>({
    q: '',
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const { data, error, loading } = useResource(
    `catalog-exercises:${JSON.stringify(query)}`,
    () => catalogApi.exercises(query),
  );
  const t = es.catalog.exercises;

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery({ q: q.trim(), page: 1, pageSize: PAGE_SIZE });
  }

  return (
    <>
      <p className="hint">{es.catalog.exercisesReadOnly}</p>
      <form className="filters" role="search" onSubmit={submit}>
        <div className="field field--grow">
          <label htmlFor="catalog-exercises-q">{t.searchLabel}</label>
          <input
            id="catalog-exercises-q"
            type="search"
            maxLength={80}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="submit" className="button button--primary">
          {t.search}
        </button>
      </form>

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
            <ExerciseTable exercises={data.items} />
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

function ExerciseTable({ exercises }: { exercises: CatalogExercise[] }) {
  const t = es.catalog.exercises;
  return (
    <div className="table-wrap">
      <table>
        <caption className="visually-hidden">{t.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.name}</th>
            <th scope="col">{t.muscleGroup}</th>
            <th scope="col">{t.category}</th>
            <th scope="col">{t.instructions}</th>
          </tr>
        </thead>
        <tbody>
          {exercises.map((exercise) => (
            <tr key={exercise.id}>
              <th scope="row">{exercise.name}</th>
              <td>{exercise.muscleGroup}</td>
              <td>{exercise.category}</td>
              <td>{exercise.instructions ?? es.common.dash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
