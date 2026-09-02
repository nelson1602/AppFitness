import type { MailMessage, MailTransport } from '../domain/mail.types';

/**
 * In-memory transport — the ONLY transport bound in unit and e2e tests
 * (ADR-P026 Decision 15). CI therefore cannot send email by construction:
 * no network call exists on this path.
 *
 * Captured messages let tests assert recipient, template id, locale and the
 * rendered link, and let them prove that a raw token never reached a log or an
 * audit row while still being present in the email itself.
 */
export class FakeMailTransport implements MailTransport {
  readonly name = 'fake';

  private readonly messages: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }

  /** Everything sent so far, oldest first. */
  get sent(): readonly MailMessage[] {
    return this.messages;
  }

  /** Most recent message, or undefined when nothing was sent. */
  last(): MailMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  reset(): void {
    this.messages.length = 0;
  }
}
