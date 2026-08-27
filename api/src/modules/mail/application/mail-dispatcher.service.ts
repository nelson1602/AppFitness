import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';

/**
 * Runs a send outside the request/response path.
 *
 * Why this exists: `POST /auth/forgot-password` must not let provider latency
 * become an enumeration signal (ADR-P026 Decision 8). Awaiting the provider
 * would make the "account exists" branch pay a network round-trip that the
 * "no such account" branch skips — a timing difference far larger than any
 * response-duration floor could reasonably absorb. Dispatching keeps the
 * measured work on both branches down to the same few database milliseconds.
 *
 * This is NOT a queue or a job runner (ADR-P026 Decision 12 forbids both):
 * there is no broker and no scheduler.
 *
 * **Delivery is best-effort and explicitly not guaranteed.** There is no
 * persistence, no retry, and no dead-letter path. An in-flight send is lost if
 * the process crashes, is OOM-killed, or is force-terminated before it
 * completes, and a provider error is logged and then dropped. The user-visible
 * consequence is a reset email that never arrives while the endpoint has
 * already answered 202 — the reset token itself is committed, so the user's
 * recovery is to request another link, and the request is not silently
 * "successful" in any durable sense. `drain()` narrows the crash window for
 * the ordinary case (a Railway deploy replacement sends SIGTERM, and Nest's
 * shutdown hook awaits the drain) but cannot cover a hard kill.
 *
 * Accepting that risk is the cost of not introducing Redis/BullMQ; a durable
 * outbox is the correct fix and needs its own decision.
 *
 * Failures are logged with the error class name only — never the recipient,
 * the message, or the token.
 */
@Injectable()
export class MailDispatcher implements OnApplicationShutdown {
  private readonly logger = new Logger(MailDispatcher.name);
  private readonly pending = new Set<Promise<void>>();

  /** Fire-and-forget. `scope` names the flow, e.g. 'auth.passwordReset'. */
  dispatch(scope: string, task: () => Promise<void>): void {
    const settled: Promise<void> = (async () => {
      try {
        await task();
      } catch (error) {
        const cause = error instanceof Error ? error.name : 'unknown error';
        this.logger.error(`Mail dispatch failed (${scope}): ${cause}`);
      }
    })();

    this.pending.add(settled);
    void settled.finally(() => this.pending.delete(settled));
  }

  /** Resolves once every in-flight dispatch has settled. */
  async drain(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.drain();
  }
}
