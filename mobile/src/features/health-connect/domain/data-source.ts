/**
 * Which app's data the watch card and the iCoach read (ADR-P048 amendment,
 * rule `health-source@1.0.0`). Pure and deterministic.
 *
 * Health Connect's unfiltered aggregate follows the phone's app priority, so
 * when the phone and the watch come from different brands the phone's own app
 * can win and the watch's data is dropped (Honor phone + Samsung watch: 156
 * steps instead of 1,117). Totals are therefore read for ONE origin (an app's
 * package name), never several added together:
 *
 * 1. the origin the person picked in Perfil, kept on the phone per account;
 * 2. else an origin whose records come from a watch (highest steps first);
 * 3. else the origin with the most steps today.
 *
 * Ties are broken by package name, so identical inputs always choose the same
 * origin. For a type the chosen origin has no data for, the caller falls back
 * to Health Connect's unfiltered aggregate. With no origin found, everything
 * is unfiltered, exactly as before.
 */
export const HEALTH_SOURCE_RULE_VERSION = 'health-source@1.0.0';

/** An app that wrote Steps, active calories or hydration today. */
export interface HealthOrigin {
  /** Package name, e.g. `com.sec.android.app.shealth`. */
  packageName: string;
  /** At least one of its records today came from a watch. */
  isWatch: boolean;
  /** Its own steps today (origin-filtered aggregate); null when it has none. */
  steps: number | null;
}

const byPackage = (a: HealthOrigin, b: HealthOrigin) => a.packageName.localeCompare(b.packageName);
const mostSteps = (a: HealthOrigin, b: HealthOrigin) =>
  (b.steps ?? 0) - (a.steps ?? 0) || byPackage(a, b);

/** The origin to read, or null to read Health Connect unfiltered. */
export function chooseSource(
  origins: readonly HealthOrigin[],
  picked: string | null,
): string | null {
  if (picked !== null) return picked;
  if (origins.length === 0) return null;
  const watches = origins.filter((origin) => origin.isWatch);
  const pool = watches.length > 0 ? watches : origins;
  return [...pool].sort(mostSteps)[0].packageName;
}

/** Known apps' display names; any other origin shows its package name. */
const KNOWN_SOURCES: Readonly<Record<string, string>> = {
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.huawei.health': 'Huawei Health',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
};
/** Honor's app is named differently per language ("Salud" / "Health"). */
export const HONOR_HEALTH_PACKAGE = 'com.hihonor.health';

/**
 * The name to show for an origin. `honorLabel` is the localized name of
 * Honor's app; brand names are not translated.
 */
export function sourceLabel(packageName: string, honorLabel: string): string {
  if (packageName === HONOR_HEALTH_PACKAGE) return honorLabel;
  return KNOWN_SOURCES[packageName] ?? packageName;
}

export interface OriginSession {
  /** ISO instants. */
  startTime: string;
  endTime: string;
  /** Package name of the app that wrote it. */
  origin: string;
}

const overlaps = (a: OriginSession, b: OriginSession) =>
  Date.parse(a.startTime) < Date.parse(b.endTime) &&
  Date.parse(b.startTime) < Date.parse(a.endTime);

/**
 * Exercise sessions with the same workout written by two apps counted once.
 * Sessions are grouped into clusters that overlap in time. In a cluster with
 * more than one origin, only one origin's sessions are kept: the chosen
 * source's, else the origin of the cluster's earliest session (then by
 * package name). Sessions from one origin are never dropped against each
 * other. Output is in start order.
 */
export function pickSessions<T extends OriginSession>(
  sessions: readonly T[],
  source: string | null,
): T[] {
  const sorted = [...sessions].sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || a.origin.localeCompare(b.origin),
  );
  const clusters: T[][] = [];
  for (const session of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && last.some((other) => overlaps(other, session))) last.push(session);
    else clusters.push([session]);
  }
  return clusters.flatMap((cluster) => {
    const origins = new Set(cluster.map((session) => session.origin));
    if (origins.size === 1) return cluster;
    const keep = source !== null && origins.has(source) ? source : cluster[0].origin;
    return cluster.filter((session) => session.origin === keep);
  });
}
