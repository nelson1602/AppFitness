/**
 * Transactional-mail configuration (ADR-P026 Vertical 1).
 *
 * Provider-agnostic by construction: the resolved config selects which
 * `MailTransport` the mail module binds, and nothing else in the codebase
 * knows the vendor. Two providers are supported today — `disabled` (no mail
 * capability) and `postmark` (REST, no vendor SDK).
 *
 * Fail-closed rules (05_SECURITY.md):
 * - Unset/empty `MAIL_PROVIDER` resolves to `disabled`. Mail-dependent
 *   endpoints then answer with a single generic "unavailable" response —
 *   they never pretend an email was sent.
 * - An *enabled* provider with missing or malformed settings throws at boot.
 *   A half-configured mailer is a silent-failure trap, so it is refused
 *   loudly instead of degrading into a fake success.
 * - An unknown `MAIL_PROVIDER` value throws; it is never treated as
 *   `disabled` by accident.
 *
 * Pure by design (a plain env record in, a value object out) so every branch
 * is directly unit-testable without booting Nest.
 */

export const MAIL_PROVIDERS = ['disabled', 'postmark'] as const;
export type MailProvider = (typeof MAIL_PROVIDERS)[number];

/** DI token for the resolved configuration value object. */
export const MAIL_CONFIG = Symbol('MAIL_CONFIG');

export interface DisabledMailConfig {
  provider: 'disabled';
}

export interface PostmarkMailConfig {
  provider: 'postmark';
  /** Postmark *server* token. Secret — never logged, never echoed. */
  serverToken: string;
  /** RFC5322 address the provider sends from (owned sending subdomain). */
  fromAddress: string;
  /** Postmark message stream; transactional mail must not use a broadcast stream. */
  messageStream: string;
  /** Validated HTTPS origin (+ optional base path) that emailed links point at. */
  publicBaseUrl: string;
  /**
   * Separate validated HTTPS base for email-verification links (ADR-P026
   * Vertical 2 / V2-C). Verification is ordinary account hygiene, not a
   * credential-reset event, so it is served from a neutral account host
   * (`https://account.appfitnessrd.com`) rather than the recovery host.
   *
   * **Optional on purpose, and `null` when unset.** That host does not exist
   * yet — DNS and CORS for it are V2-E. Requiring it would make this slice
   * refuse to boot on every environment already running `MAIL_PROVIDER=postmark`,
   * turning an additive backend change into an outage. Instead, an unset value
   * disables *verification mail only*: no link is ever built, so a broken or
   * wrong-host link cannot be emailed. Password recovery is untouched either way.
   */
  verificationBaseUrl: string | null;
}

export type MailConfig = DisabledMailConfig | PostmarkMailConfig;

const DEFAULT_MESSAGE_STREAM = 'outbound';

// Deliberately narrow: a single address, no display name, no comma-separated
// list. The sending identity is one owned mailbox (ADR-P026 Decision 5).
const EMAIL_PATTERN = /^[^\s@,<>]+@[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;

/**
 * Validate the public base URL used to build emailed links.
 *
 * HTTPS only — a reset link is a bearer credential in a URL, so plain HTTP is
 * refused even in development. Query strings and fragments are refused because
 * the link builder appends its own `#token=` fragment. A single trailing slash is
 * tolerated and normalized away so callers can concatenate safely.
 */
export function parsePublicBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (value === '') {
    throw new Error(
      'MAIL_PUBLIC_BASE_URL is required when MAIL_PROVIDER is enabled',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `Invalid MAIL_PUBLIC_BASE_URL: "${value}". Expected an absolute https:// URL.`,
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid MAIL_PUBLIC_BASE_URL: "${value}". Emailed links must be https:// (plain HTTP is refused).`,
    );
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error(
      `Invalid MAIL_PUBLIC_BASE_URL: "${value}". A query string or fragment is not allowed.`,
    );
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error(
      `Invalid MAIL_PUBLIC_BASE_URL: "${value}". Embedded credentials are not allowed.`,
    );
  }

  // Normalize: keep any base path, drop exactly one trailing slash.
  const normalized = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  return normalized;
}

/**
 * Validate `MAIL_VERIFICATION_BASE_URL` when present; return `null` when it is
 * absent or empty.
 *
 * Absent is a supported, safe state (see `verificationBaseUrl`). Present but
 * malformed is NOT: an operator who set the variable intended verification to
 * work, and silently degrading to "disabled" would hide the typo until users
 * stopped receiving mail. Same HTTPS/no-query/no-fragment rules as the
 * recovery base — the verification link appends its own `#token=` fragment.
 */
export function parseOptionalVerificationBaseUrl(
  raw: string | undefined,
): string | null {
  if ((raw ?? '').trim() === '') return null;
  try {
    return parsePublicBaseUrl(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid value';
    throw new Error(
      detail.replace('MAIL_PUBLIC_BASE_URL', 'MAIL_VERIFICATION_BASE_URL'),
    );
  }
}

function requireValue(raw: string | undefined, name: string): string {
  const value = (raw ?? '').trim();
  if (value === '') {
    throw new Error(`${name} is required when MAIL_PROVIDER is enabled`);
  }
  return value;
}

function parseFromAddress(raw: string | undefined): string {
  const value = requireValue(raw, 'MAIL_FROM_ADDRESS');
  if (!EMAIL_PATTERN.test(value)) {
    throw new Error(
      `Invalid MAIL_FROM_ADDRESS: "${value}". Expected a single bare address like no-reply@mail.example.com.`,
    );
  }
  return value.toLowerCase();
}

/** Resolve the mail configuration from an environment record. */
export function resolveMailConfig(
  env: NodeJS.ProcessEnv = process.env,
): MailConfig {
  const provider = (env.MAIL_PROVIDER ?? '').trim().toLowerCase();

  if (provider === '' || provider === 'disabled') {
    return { provider: 'disabled' };
  }

  if (provider !== 'postmark') {
    throw new Error(
      `Unsupported MAIL_PROVIDER: "${provider}". Supported values: ${MAIL_PROVIDERS.join(', ')}.`,
    );
  }

  return {
    provider: 'postmark',
    serverToken: requireValue(
      env.POSTMARK_SERVER_TOKEN,
      'POSTMARK_SERVER_TOKEN',
    ),
    fromAddress: parseFromAddress(env.MAIL_FROM_ADDRESS),
    messageStream:
      (env.POSTMARK_MESSAGE_STREAM ?? '').trim() || DEFAULT_MESSAGE_STREAM,
    publicBaseUrl: parsePublicBaseUrl(env.MAIL_PUBLIC_BASE_URL),
    verificationBaseUrl: parseOptionalVerificationBaseUrl(
      env.MAIL_VERIFICATION_BASE_URL,
    ),
  };
}

/** True when a real transport is bound and sending is possible. */
export function isMailEnabled(config: MailConfig): boolean {
  return config.provider !== 'disabled';
}

/**
 * True when verification links can be built AND sent.
 *
 * Both halves are required: a transport with no verification base has nowhere
 * to point users, and a base with no transport has no way to reach them.
 * Callers must answer "unavailable" rather than issue a token that could never
 * be delivered.
 */
export function isVerificationMailEnabled(config: MailConfig): boolean {
  return config.provider !== 'disabled' && config.verificationBaseUrl !== null;
}
