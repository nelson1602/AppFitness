import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/presentation/decorators/public.decorator';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({ description: 'Service is up' })
  check(): HealthStatus {
    // Deliberately exposes no internals (no versions, hosts, or config)
    // per .ai/05_SECURITY.md output-sanitization rules.
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
