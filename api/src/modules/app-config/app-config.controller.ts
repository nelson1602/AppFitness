import { Controller, Get, Header } from '@nestjs/common';

import { Public } from '../auth/presentation/decorators/public.decorator';
import { AppConfigService, type PublicAppConfig } from './app-config.service';

/**
 * GET /app-config (ADR-P049 amendment 1): read by the app on start and when
 * it returns to the foreground, before or after sign-in. Public and
 * cacheable for a minute: it holds no account data.
 */
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly config: AppConfigService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  read(): Promise<PublicAppConfig> {
    return this.config.publicView();
  }
}
