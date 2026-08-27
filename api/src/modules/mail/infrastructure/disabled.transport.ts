import { MailDisabledError, type MailTransport } from '../domain/mail.types';

/**
 * Bound when `MAIL_PROVIDER` is `disabled` (or unset).
 *
 * It throws rather than resolving: a no-op transport would report success for
 * an email that was never sent, which is precisely the silent failure
 * ADR-P026 forbids. Callers must consult `MailService.enabled` and answer
 * "temporarily unavailable" instead of reaching this.
 */
export class DisabledMailTransport implements MailTransport {
  readonly name = 'disabled';

  send(): Promise<void> {
    return Promise.reject(new MailDisabledError());
  }
}
