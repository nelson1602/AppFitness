import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../../auth/domain/auth.types';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { ProfileService } from '../application/profile.service';
import type { ProfileRecord } from '../domain/profile.types';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  @ApiOperation({ summary: "Current user's profile" })
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileRecord> {
    return this.profileService.getMyProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Create or update the profile (version-bumping upsert)',
  })
  upsertProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileRecord> {
    return this.profileService.upsertMyProfile(user.id, dto);
  }
}
