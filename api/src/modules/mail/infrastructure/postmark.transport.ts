import type { PostmarkMailConfig } from '../../../config/mail.config';
import {
  MailDeliveryError,
  type MailMessage,
  type MailTransport,
} from '../domain/mail.types';

/**
 * Postmark REST adapter (ADR-P026 Decision 2 — no vendor SDK).
 *
 * One POST to the transactional `/email` endpoint using the platform `fetch`,
 * which Node 24 provides natively. Keeping the vendor behind ~40 lines of
 * request building is the point of the port: swapping providers is a new file,
 * not a refactor.
 *
 * Secret discipline: the server token is sent in a header and never appears in
 * an error, a log line, or a thrown message. Failures surface the HTTP status
 * only — a provider error body can echo the recipient address back.
 */

export const POSTMARK_EMAIL_ENDPOINT = 'https://api.postmarkapp.com/email';

/** How long to wait on the provider before giving up. */
export const POSTMARK_TIMEOUT_MS = 10_000;

export class PostmarkMailTransport implements MailTransport {
  readonly name = 'postmark';

  constructor(private readonly config: PostmarkMailConfig) {}

  async send(message: MailMessage): Promise<void> {
    let response: Response;
    try {
      response = await fetch(POSTMARK_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.config.serverToken,
        },
        body: JSON.stringify({
          From: this.config.fromAddress,
          To: message.to,
          Subject: message.subject,
          TextBody: message.textBody,
          HtmlBody: message.htmlBody,
          MessageStream: this.config.messageStream,
        }),
        signal: AbortSignal.timeout(POSTMARK_TIMEOUT_MS),
      });
    } catch (error) {
      // Network/timeout. Only the error class name is reported — a fetch
      // failure message can embed the request URL and other context.
      const cause = error instanceof Error ? error.name : 'unknown error';
      throw new MailDeliveryError(`provider unreachable (${cause})`);
    }

    if (!response.ok) {
      // Status only: the response body may contain the recipient address.
      throw new MailDeliveryError(
        `provider rejected the message (HTTP ${response.status})`,
      );
    }
  }
}
