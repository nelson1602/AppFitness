import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { catalogApi } from '../../api/endpoints';
import type { CatalogFoodInput, CatalogFoodView } from '../../api/types';
import { Banner, ErrorText, Loading } from '../../components/Banner';
import type { BannerMessage } from '../../components/Banner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatDateTime, formatNumber } from '../../format';
import { useResource } from '../../hooks/useResource';
import { es } from '../../i18n/es';
import { href, navigate, paths } from '../../router';
import type { NotifyFn } from './catalogFormat';
import { catalogErrorMessage, servingText } from './catalogFormat';
import { FoodForm } from './FoodForm';

type Mode = 'view' | 'correct' | 'retire';

interface FoodDetailProps {
  foodId: string;
  notice: BannerMessage | null;
  onNotice: NotifyFn;
  onDismissNotice: () => void;
}

export function FoodDetail({
  foodId,
  notice,
  onNotice,
  onDismissNotice,
}: FoodDetailProps) {
  const { data, error, loading, reload } = useResource(
    `catalog-food:${foodId}`,
    () => catalogApi.food(foodId),
  );
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState(false);
  const food = data?.food;

  async function runAction(
    task: () => Promise<CatalogFoodView>,
    success: string,
  ) {
    setBusy(true);
    try {
      await task();
      onNotice(foodId, { kind: 'success', text: success });
    } catch (err) {
      onNotice(foodId, {
        kind: 'error',
        text: es.catalog.actionFailed(catalogErrorMessage(err)),
      });
    } finally {
      setBusy(false);
      setMode('view');
      reload();
    }
  }

  async function correct(input: CatalogFoodInput) {
    const next = await catalogApi.reviseFood(foodId, input);
    onNotice(next.id, {
      kind: 'success',
      text: es.catalog.detail.corrected(next.foodRevision),
    });
    setMode('view');
    if (next.id === foodId) reload();
    else navigate(paths.catalogFood(next.id));
  }

  return (
    <section aria-labelledby="catalog-food-title">
      <p>
        <a href={href(paths.catalog)}>{es.catalog.detail.back}</a>
      </p>
      <h1 id="catalog-food-title">{food?.name ?? es.catalog.title}</h1>
      <Banner message={notice} onDismiss={onDismissNotice} />
      {error ? <ErrorText>{errorMessage(error)}</ErrorText> : null}
      {loading && !data ? <Loading /> : null}
      {food && data ? (
        <>
          <FoodSummary food={food} />
          <FoodActions
            food={food}
            busy={busy}
            correcting={mode === 'correct'}
            onCorrect={() => setMode('correct')}
            onRetire={() => setMode('retire')}
            onRestore={() =>
              void runAction(
                () => catalogApi.restoreFood(foodId),
                es.catalog.detail.restored,
              )
            }
          />
          {mode === 'correct' ? (
            <FoodForm
              title={es.catalog.detail.correctTitle}
              submitLabel={es.catalog.form.saveCorrection}
              initial={food}
              onSubmit={correct}
              onCancel={() => setMode('view')}
            />
          ) : null}
          <RevisionTable revisions={data.revisions} />
          {mode === 'retire' ? (
            <ConfirmDialog
              title={es.catalog.detail.retireTitle}
              confirmLabel={es.catalog.detail.retireConfirm}
              destructive
              busy={busy}
              onCancel={() => setMode('view')}
              onConfirm={() =>
                void runAction(
                  () => catalogApi.retireFood(foodId),
                  es.catalog.detail.retired,
                )
              }
            >
              <p>{es.catalog.retireExplain}</p>
            </ConfirmDialog>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function FoodSummary({ food }: { food: CatalogFoodView }) {
  const t = es.catalog.foods;
  const d = es.catalog.detail;
  return (
    <section className="card" aria-labelledby="catalog-food-summary">
      <h2 id="catalog-food-summary">{d.summary}</h2>
      <dl className="details">
        <dt>{t.brand}</dt>
        <dd>{food.brand ?? es.common.dash}</dd>
        <dt>{t.kind}</dt>
        <dd>{es.catalog.kinds[food.kind]}</dd>
        <dt>{t.status}</dt>
        <dd>
          <span className={`pill pill--${food.status}`}>
            {es.catalog.statuses[food.status]}
          </span>
        </dd>
        <dt>{t.revision}</dt>
        <dd>{formatNumber(food.foodRevision)}</dd>
        <dt>{t.serving}</dt>
        <dd>{servingText(food)}</dd>
        <dt>{t.calories}</dt>
        <dd>{formatNumber(food.caloriesPerServing)}</dd>
        <dt>{t.protein}</dt>
        <dd>{formatNumber(food.proteinPerServing)}</dd>
        <dt>{t.carbs}</dt>
        <dd>{formatNumber(food.carbsPerServing)}</dd>
        <dt>{t.fat}</dt>
        <dd>{formatNumber(food.fatPerServing)}</dd>
        <dt>{t.fiber}</dt>
        <dd>
          {food.fiberPerServing === null
            ? es.common.dash
            : formatNumber(food.fiberPerServing)}
        </dd>
        <dt>{d.catalogKey}</dt>
        <dd className="break">{food.catalogKey}</dd>
        <dt>{d.catalogVersion}</dt>
        <dd>{food.catalogVersion ?? es.common.dash}</dd>
        <dt>{t.createdAt}</dt>
        <dd>{formatDateTime(food.createdAt)}</dd>
        {food.retiredAt ? (
          <>
            <dt>{d.retiredAt}</dt>
            <dd>{formatDateTime(food.retiredAt)}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

interface FoodActionsProps {
  food: CatalogFoodView;
  busy: boolean;
  correcting: boolean;
  onCorrect: () => void;
  onRetire: () => void;
  onRestore: () => void;
}

function FoodActions({
  food,
  busy,
  correcting,
  onCorrect,
  onRetire,
  onRestore,
}: FoodActionsProps) {
  const d = es.catalog.detail;
  let body;
  if (food.kind === 'bundled') {
    body = <p>{es.catalog.bundledReadOnly}</p>;
  } else if (!food.editable) {
    body = <p>{es.catalog.supersededReadOnly}</p>;
  } else {
    body = (
      <>
        {food.status === 'active' ? (
          <>
            <p className="hint">{es.catalog.correctExplain}</p>
            <p className="hint">{es.catalog.retireExplain}</p>
          </>
        ) : (
          <p className="hint">{es.catalog.restoreBeforeCorrect}</p>
        )}
        <div className="button-row button-row--wrap">
          {/* The server corrects only an active food (409 when retired). */}
          {food.status === 'active' ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busy || correcting}
              onClick={onCorrect}
            >
              {d.correct}
            </button>
          ) : null}
          {food.status === 'active' ? (
            <button
              type="button"
              className="button button--danger-outline"
              disabled={busy}
              onClick={onRetire}
            >
              {d.retire}
            </button>
          ) : null}
          {food.status === 'retired' ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={onRestore}
            >
              {busy ? es.common.working : d.restore}
            </button>
          ) : null}
        </div>
      </>
    );
  }
  return (
    <section className="card" aria-labelledby="catalog-food-actions">
      <h2 id="catalog-food-actions">{d.actionsTitle}</h2>
      {body}
    </section>
  );
}

function RevisionTable({ revisions }: { revisions: CatalogFoodView[] }) {
  const t = es.catalog.foods;
  const d = es.catalog.detail;
  return (
    <section className="card" aria-labelledby="catalog-food-revisions">
      <h2 id="catalog-food-revisions">{d.revisionsTitle}</h2>
      <div className="table-wrap">
        <table>
          <caption className="visually-hidden">{d.revisionsCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{t.revision}</th>
              <th scope="col">{t.status}</th>
              <th scope="col">{t.calories}</th>
              <th scope="col">{t.protein}</th>
              <th scope="col">{t.carbs}</th>
              <th scope="col">{t.fat}</th>
              <th scope="col">{t.createdAt}</th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((revision) => (
              <tr key={revision.id}>
                <th scope="row">{formatNumber(revision.foodRevision)}</th>
                <td>
                  <span className={`pill pill--${revision.status}`}>
                    {es.catalog.statuses[revision.status]}
                  </span>
                </td>
                <td>{formatNumber(revision.caloriesPerServing)}</td>
                <td>{formatNumber(revision.proteinPerServing)}</td>
                <td>{formatNumber(revision.carbsPerServing)}</td>
                <td>{formatNumber(revision.fatPerServing)}</td>
                <td>{formatDateTime(revision.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
