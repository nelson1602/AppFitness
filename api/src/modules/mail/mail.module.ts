import { Module } from '@nestjs/common';

import {
  MAIL_CONFIG,
  resolveMailConfig,
  type MailConfig,
} from '../../config/mail.config';

import { MailDispatcher } from './application/mail-dispatcher.service';
import { MailService } from './application/mail.service';
import { MAIL_TRANSPORT } from './domain/mail.types';
import { DisabledMailTransport } from './infrastructure/disabled.transport';
import { PostmarkMailTransport } from './infrastructure/postmark.transport';

/**
 * Transactional-mail module (ADR-P026 Vertical 1).
 *
 * Binds exactly one `MailTransport` from the resolved configuration. A
 * misconfigured *enabled* provider throws inside `resolveMailConfig` during
 * module instantiation, so the process refuses to boot rather than starting a
 * mailer that silently drops messages.
 *
 * Tests override `MAIL_CONFIG` and `MAIL_TRANSPORT` with the fake transport;
 * no test path can reach `PostmarkMailTransport`.
 */
@Module({
  providers: [
    { provide: MAIL_CONFIG, useFactory: (): MailConfig => resolveMailConfig() },
    {
      provide: MAIL_TRANSPORT,
      inject: [MAIL_CONFIG],
      useFactory: (config: MailConfig) =>
        config.provider === 'postmark'
          ? new PostmarkMailTransport(config)
          : new DisabledMailTransport(),
    },
    MailService,
    MailDispatcher,
  ],
  exports: [MailService, MailDispatcher, MAIL_CONFIG, MAIL_TRANSPORT],
})
export class MailModule {}
