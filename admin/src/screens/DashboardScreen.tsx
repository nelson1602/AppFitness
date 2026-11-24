import { useId } from 'react';
import { errorMessage } from '../api/client';
import { metricsApi } from '../api/endpoints';
import type { DashboardMetrics } from '../api/types';
import { ErrorText, Loading } from '../components/Banner';
import { formatDay, formatNumber, formatPercent } from '../format';
import { useResource } from '../hooks/useResource';
import { es } from '../i18n/es';

export function DashboardScreen() {
  const { data, error, loading } = useResource('dashboard', () =>
    metricsApi.dashboard(),
  );

  return (
    <section aria-labelledby="dashboard-title">
      <h1 id="dashboard-title">{es.dashboard.title}</h1>
      {error ? <ErrorText>{errorMessage(error)}</ErrorText> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <ul className="tiles">
            <Tile
              label={es.dashboard.totalUsers}
              value={formatNumber(data.totalUsers)}
            />
            <Tile
              label={es.dashboard.verifiedPct}
              value={formatPercent(data.verifiedPct)}
            />
            <Tile
              label={es.dashboard.active7d}
              value={formatNumber(data.active7d)}
            />
            <Tile
              label={es.dashboard.proCount}
              value={formatNumber(data.proCount)}
            />
          </ul>
          <NewPerDayChart series={data.newPerDay} />
        </>
      ) : null}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <li className="tile">
      <span className="tile__label">{label}</span>
      <span className="tile__value">{value}</span>
    </li>
  );
}

const CHART_HEIGHT = 160;
const BAR_GAP = 2;

function NewPerDayChart({ series }: { series: DashboardMetrics['newPerDay'] }) {
  const titleId = useId();
  const descId = useId();
  const total = series.reduce((sum, point) => sum + point.count, 0);
  const max = Math.max(1, ...series.map((point) => point.count));
  const width = Math.max(series.length, 1) * 12;
  const barWidth = 12 - BAR_GAP;
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <section className="card chart" aria-labelledby={titleId}>
      <h2 id={titleId}>{es.dashboard.newPerDayTitle}</h2>
      {series.length === 0 ? (
        <p className="muted">{es.dashboard.empty}</p>
      ) : (
        <>
          <p id={descId} className="muted">
            {es.dashboard.newPerDayDesc(series.length, total)}
          </p>
          <svg
            className="chart__svg"
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
          >
            <line
              className="chart__baseline"
              x1={0}
              x2={width}
              y1={CHART_HEIGHT - 0.5}
              y2={CHART_HEIGHT - 0.5}
            />
            {series.map((point, index) => {
              const height =
                point.count === 0
                  ? 0
                  : Math.max(2, (point.count / max) * (CHART_HEIGHT - 4));
              return (
                <rect
                  key={point.date}
                  className="chart__bar"
                  x={index * 12 + BAR_GAP / 2}
                  y={CHART_HEIGHT - height}
                  width={barWidth}
                  height={height}
                  rx={Math.min(2, height / 2)}
                >
                  <title>
                    {es.dashboard.barTitle(formatDay(point.date), point.count)}
                  </title>
                </rect>
              );
            })}
          </svg>
          {first && last ? (
            <div className="chart__axis" aria-hidden="true">
              <span>{formatDay(first.date)}</span>
              <span>{formatDay(last.date)}</span>
            </div>
          ) : null}
          <table className="visually-hidden">
            <caption>{es.dashboard.tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{es.dashboard.date}</th>
                <th scope="col">{es.dashboard.count}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatDay(point.date)}</th>
                  <td>{formatNumber(point.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
