/**
 * Server-driven app configuration (ADR-P049 amendment 1): the public
 * `GET /app-config` answer, read defensively. Nothing in the app depends on it
 * being present — a missing, failed or malformed answer means "no notice".
 */

export type MaintenanceTone = 'info' | 'warning';

export interface MaintenanceNotice {
  tone: MaintenanceTone;
  /** Both languages are always filled (one may repeat the other). */
  message: { es: string; en: string };
}

export interface AppConfig {
  maintenance: MaintenanceNotice | null;
  /**
   * The lowest Android versionCode the server still serves. Enforced by
   * `isUpdateRequired` against the installed versionCode (read through
   * `expo-application`); null means no minimum.
   */
  minAndroidVersionCode: number | null;
}

export const EMPTY_APP_CONFIG: AppConfig = { maintenance: null, minAndroidVersionCode: null };

/** The longest message shown, in characters (code points). */
export const MAINTENANCE_MESSAGE_MAX_LENGTH = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Trimmed and capped, without splitting a surrogate pair; '' when not a string. */
function cleanMessage(value: unknown): string {
  if (typeof value !== 'string') return '';
  const points = Array.from(value.trim());
  if (points.length <= MAINTENANCE_MESSAGE_MAX_LENGTH) return points.join('');
  return points.slice(0, MAINTENANCE_MESSAGE_MAX_LENGTH).join('').trimEnd();
}

function parseMaintenance(value: unknown): MaintenanceNotice | null {
  if (!isRecord(value) || !isRecord(value.message)) return null;
  const es = cleanMessage(value.message.es);
  const en = cleanMessage(value.message.en);
  // A notice in one language only is shown in that language to everyone.
  if (es === '' && en === '') return null;
  return {
    tone: value.tone === 'info' ? 'info' : 'warning',
    message: { es: es || en, en: en || es },
  };
}

function parseVersionCode(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * Pure: true only on Android, when both the minimum and the installed
 * versionCode are known and the installed one is below the minimum. Fails
 * open — no config, an unreadable installed version, iOS or Web all answer
 * false — so a bad read never locks anyone out.
 */
export function isUpdateRequired(
  minAndroidVersionCode: number | null,
  platform: string,
  installedVersionCode: number | null,
): boolean {
  if (platform !== 'android') return false;
  if (minAndroidVersionCode === null || installedVersionCode === null) return false;
  return installedVersionCode < minAndroidVersionCode;
}

/** Pure: any shape the server (or a proxy) might send becomes a valid config. */
export function parseAppConfig(body: unknown): AppConfig {
  if (!isRecord(body)) return EMPTY_APP_CONFIG;
  return {
    maintenance: parseMaintenance(body.maintenance),
    minAndroidVersionCode: parseVersionCode(body.minAndroidVersionCode),
  };
}
