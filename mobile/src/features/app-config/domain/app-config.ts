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
   * Parsed and kept, but not acted on yet: telling "update required" apart
   * needs the installed native versionCode, which needs `expo-application` —
   * a new dependency the owner has not approved.
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

/** Pure: any shape the server (or a proxy) might send becomes a valid config. */
export function parseAppConfig(body: unknown): AppConfig {
  if (!isRecord(body)) return EMPTY_APP_CONFIG;
  return {
    maintenance: parseMaintenance(body.maintenance),
    minAndroidVersionCode: parseVersionCode(body.minAndroidVersionCode),
  };
}
