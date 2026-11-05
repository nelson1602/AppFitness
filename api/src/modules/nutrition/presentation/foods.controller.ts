import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../../auth/domain/auth.types';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { ActiveEntitlementGuard } from '../../subscriptions/presentation/guards/active-entitlement.guard';
import {
  FoodSearchService,
  type FoodSearchResponse,
} from '../application/food-search.service';
import type { CanonicalFood } from '../catalog/catalog-identity';
import {
  CreateCustomFoodDto,
  FoodSearchQueryDto,
  ImportFoodDto,
} from './dto/food.dto';

const DEFAULT_SEARCH_LIMIT = 15;

/**
 * Food search beyond the bundled list (ADR-P045). Protected by the global JWT
 * guard; the two writes are paid product mutations (ADR-P034).
 */
@ApiTags('foods')
@ApiBearerAuth()
@Controller('foods')
export class FoodsController {
  constructor(private readonly foods: FoodSearchService) {}

  // Each search fans out to two external services; 30 / 60 s per client keeps
  // typing-driven bursts well inside their published limits.
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @Get('search')
  @ApiOperation({
    summary: 'Search the catalogue, then Open Food Facts and USDA FDC',
  })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FoodSearchQueryDto,
  ): Promise<FoodSearchResponse> {
    return this.foods.search(
      user.id,
      query.q,
      query.limit ?? DEFAULT_SEARCH_LIMIT,
    );
  }

  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @Post('import')
  @HttpCode(200)
  @UseGuards(ActiveEntitlementGuard)
  @ApiOperation({
    summary: 'Import an external food into the shared catalogue (re-fetched)',
  })
  import(@Body() dto: ImportFoodDto): Promise<CanonicalFood> {
    return this.foods.importExternal(dto.source, dto.sourceId);
  }

  @Post('custom')
  @UseGuards(ActiveEntitlementGuard)
  @ApiOperation({ summary: 'Create a private custom food' })
  custom(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomFoodDto,
  ): Promise<CanonicalFood> {
    return this.foods.createCustom(user.id, dto);
  }
}
