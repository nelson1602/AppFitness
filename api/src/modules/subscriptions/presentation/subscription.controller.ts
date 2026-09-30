import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { createHash } from 'node:crypto';

import {
  REVENUECAT_CONFIG,
  type RevenueCatConfig,
} from '../../../config/revenuecat.config';
import type { AuthenticatedUser } from '../../auth/domain/auth.types';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { Public } from '../../auth/presentation/decorators/public.decorator';
import {
  SubscriptionService,
  parseRevenueCatEvent,
} from '../application/subscription.service';
import type {
  SubscriptionStatusView,
  WebhookIngestionResult,
} from '../domain/subscription.types';
import { verifyRevenueCatWebhook } from '../infrastructure/revenuecat-webhook.verifier';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    @Inject(REVENUECAT_CONFIG)
    private readonly config: RevenueCatConfig,
  ) {}

  @ApiBearerAuth()
  @Get('status')
  @ApiOperation({ summary: 'Get the server entitlement mirror' })
  status(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubscriptionStatusView> {
    return this.subscriptions.getStatus(user.id);
  }

  @ApiBearerAuth()
  @Post('reconcile')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh the authenticated account from the entitlement provider',
  })
  reconcile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubscriptionStatusView> {
    return this.subscriptions.reconcile(user.id);
  }

  @Public()
  @Post('webhooks/revenuecat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive a signed RevenueCat lifecycle event' })
  webhook(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-revenuecat-webhook-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
    @Body() body: unknown,
  ): Promise<WebhookIngestionResult> {
    if (this.config.provider !== 'revenuecat') {
      throw new ServiceUnavailableException(
        'Subscription provider is unavailable',
      );
    }
    verifyRevenueCatWebhook(
      this.config,
      authorization,
      signature,
      request.rawBody,
    );
    const event = parseRevenueCatEvent(body);
    const payloadHash = createHash('sha256')
      .update(request.rawBody as Buffer)
      .digest('hex');
    return this.subscriptions.ingestWebhook(event, payloadHash);
  }
}
