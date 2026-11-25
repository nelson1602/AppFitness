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

/** Known apps' display names (brand names are not translated). */
const KNOWN_SOURCES: Readonly<Record<string, string>> = {
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.huawei.health': 'Huawei Health',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.huami.watch.hmwatchmanager': 'Zepp',
};
/** Honor's app is named differently per language ("Honor Salud" / "Honor Health"). */
export const HONOR_HEALTH_PACKAGE = 'com.hihonor.health';
/**
 * Health Connect's own origins: the phone's sensors, written as
 * `com.android.healthconnect.<…>` (e.g. `…phone.<hash>` on Honor).
 */
const THIS_PHONE_PREFIX = 'com.android.healthconnect.';

/** The localized names the app supplies. */
export interface SourceLabelCopy {
  /** Honor's health app. */
  honor: string;
  /** "Este teléfono" / "This phone". */
  thisPhone: string;
  /** "Otra app" / "Other app". */
  otherApp: string;
}

/**
 * The name to show for an origin. Never a raw package name or hash: an app
 * we do not know is "Other app".
 */
export function sourceLabel(packageName: string, copy: SourceLabelCopy): string {
  if (packageName === HONOR_HEALTH_PACKAGE) return copy.honor;
  if (packageName.startsWith(THIS_PHONE_PREFIX)) return copy.thisPhone;
  return KNOWN_SOURCES[packageName] ?? copy.otherApp;
}

/**
 * Names for a list of origins, kept distinct: when several origins share a
 * name ("Other app", or two of the phone's own), they are numbered in
 * package-name order ("Other app 1", "Other app 2"). Deterministic.
 */
export function sourceLabels(
  packageNames: readonly string[],
  copy: SourceLabelCopy,
): Map<string, string> {
  const unique = [...new Set(packageNames)].sort((a, b) => a.localeCompare(b));
  const names = unique.map((packageName) => sourceLabel(packageName, copy));
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  unique.forEach((packageName, i) => {
    const name = names[i];
    if ((counts.get(name) ?? 0) < 2) {
      labels.set(packageName, name);
      return;
    }
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    labels.set(packageName, `${name} ${n}`);
  });
  return labels;
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
